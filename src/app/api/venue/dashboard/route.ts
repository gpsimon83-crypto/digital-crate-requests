import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireVenueAccess } from "@/lib/venue/server";
import { holidaysInMonth, upcomingHolidays } from "@/lib/venue/holidays";
import { fetchVenueNights, type CalendarNight } from "@/lib/venue/calendar-feed";
import { normalizeNights } from "@/lib/venue/types";
import { resolveDjName, venueSearchNames, type CalendarDjName } from "@/lib/venue/calendar-options";

const TZ = "America/Chicago";

function todayIso() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** Wide UTC window around a Chicago month (filtered precisely by local date below). */
function monthWindow(month: string) {
  const [y, m] = month.split("-").map(Number);
  return { from: new Date(Date.UTC(y, m - 1, 1, 0) - 86400000).toISOString(), to: new Date(Date.UTC(y, m, 1) + 2 * 86400000).toISOString() };
}

function localDate(iso: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

type EventRow = {
  id: string;
  event_category: string | null;
  event_type: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string | null;
  dj_id: string | null;
  djs: { display_name?: string; photo_url?: string | null } | null;
};

/**
 * Everything the venue dashboard shows, scoped to one venue the caller is
 * allowed to see. Client details (names, notes, money) are never included:
 * a venue sees that a night is booked, when, and which DJ, nothing more.
 */
export async function GET(req: NextRequest) {
  const access = await requireVenueAccess(req.nextUrl.searchParams.get("venue"));
  if (access instanceof NextResponse) return access;
  const { venue, venues, preview } = access;

  const today = todayIso();
  const reqMonth = req.nextUrl.searchParams.get("month") ?? "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(reqMonth) ? reqMonth : today.slice(0, 7);

  try {
    const db = createAdminClient();
    const shape = (e: EventRow) => ({
      id: e.id,
      date: e.starts_at ? localDate(e.starts_at) : null,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      label: e.event_category ? `${e.event_category[0].toUpperCase()}${e.event_category.slice(1)} event` : "Private event",
      status: e.status === "confirmed" || e.status === "live" || e.status === "ended" ? "confirmed" : e.status === "declined" ? "cancelled" : "pending",
      dj: e.djs?.display_name ? { name: e.djs.display_name, photo_url: e.djs.photo_url ?? null } : null
    });
    const cols = "id, event_category, event_type, starts_at, ends_at, status, dj_id, djs(display_name, photo_url)";

    // Nights from the shared DCDJ calendar (via the WordPress site) for this venue's calendar names.
    const recurring = normalizeNights(venue.recurring_nights);
    const nightLabel = (date: string) => {
      const day = new Date(`${date}T12:00:00Z`).getUTCDay();
      return recurring.find((r) => r.day === day && r.label)?.label || "DCDJs night";
    };
    const djMap: CalendarDjName[] = [];
    const djPhotos = new Map<string, string | null>();
    const fromCalendar = (n: CalendarNight) => {
      // Your list wins: "J Prime" on the calendar shows as the actual name you gave that DJ.
      const mapped = resolveDjName(djMap, n.dj_text, n.dj?.name);
      const dj = mapped
        ? { name: mapped.display_name, photo_url: djPhotos.get(mapped.display_name.toLowerCase()) ?? n.dj?.photo_url ?? null }
        : n.dj;
      return {
        id: n.id,
        date: n.date,
        starts_at: n.starts_at,
        ends_at: n.ends_at,
        label: nightLabel(n.date),
        status: (n.state === "confirmed" ? "confirmed" : "pending") as "confirmed" | "pending",
        dj,
        source: "calendar" as const
      };
    };
    // DJs as written on the calendar → actual names (also used to skip DJ names saved as venue names).
    const { data: djMapRows, error: djMapErr } = await db.from("calendar_dj_names").select("id, calendar_name, display_name");
    const djMapLoaded = (djMapErr ? [] : (djMapRows ?? [])) as CalendarDjName[];
    // The venue's own name ("Casey Keys" → also "Casey Key") plus saved calendar names that aren't DJs.
    const names = venueSearchNames(venue.name, venue.calendar_names ?? [], djMapLoaded);
    // Words that identify this venue in cratesdjs.com data: its name plus its calendar names.
    // Characters with meaning in PostgREST filters are dropped, so a name can never change the query.
    const terms = [...new Set(names.map((t) => String(t ?? "").replace(/[,()*%\\"'.:]/g, " ").replace(/\s+/g, " ").trim()).filter((t) => t.length >= 3))].slice(0, 12);
    const nameMatch = terms.map((t) => `venue_name.ilike.*${t}*`).join(",");
    const summaryMatch = terms.map((t) => `summary.ilike.*${t}*`).join(",");

    const win = monthWindow(month);
    const nowIso = new Date().toISOString();
    const upTo = new Date(Date.now() + 120 * 86400000).toISOString();
    const none = Promise.resolve({ data: [] as unknown[], error: null });
    const [monthFeed, upcomingFeed, monthRes, upcomingRes, lineupRes, namedMonthRes, namedUpcomingRes, blocksMonthRes, blocksUpRes] = await Promise.all([
      fetchVenueNights(names, month, 1),
      fetchVenueNights(names, today.slice(0, 7), 3),
      db.from("events").select(cols).eq("venue_id", venue.id).gte("starts_at", win.from).lt("starts_at", win.to).order("starts_at"),
      db.from("events").select(cols).eq("venue_id", venue.id).gte("starts_at", nowIso).neq("status", "declined").order("starts_at").limit(8),
      db.from("venue_djs").select("djs(id, display_name, photo_url, top_genres, specialties, event_types)").eq("venue_id", venue.id),
      // CRM projects not linked to the venue record but entered with its name (e.g. website inquiries once booked).
      nameMatch
        ? db.from("events").select(cols).is("venue_id", null).or(nameMatch).not("status", "in", "(inquiry,declined)").gte("starts_at", win.from).lt("starts_at", win.to).order("starts_at")
        : none,
      nameMatch
        ? db.from("events").select(cols).is("venue_id", null).or(nameMatch).not("status", "in", "(inquiry,declined)").gte("starts_at", nowIso).order("starts_at").limit(8)
        : none,
      // Google Calendar events already pulled into the cratesdjs.com Calendar page.
      summaryMatch
        ? db.from("external_calendar_busy_blocks").select("google_event_id, summary, starts_at, ends_at").or(summaryMatch).gte("starts_at", win.from).lt("starts_at", win.to).order("starts_at")
        : none,
      summaryMatch
        ? db.from("external_calendar_busy_blocks").select("google_event_id, summary, starts_at, ends_at").or(summaryMatch).gte("ends_at", nowIso).lt("starts_at", upTo).order("starts_at").limit(12)
        : none
    ]);
    if (monthRes.error) throw monthRes.error;
    if (upcomingRes.error) throw upcomingRes.error;
    if (lineupRes.error) throw lineupRes.error;
    djMap.push(...djMapLoaded);
    if (djMap.length) {
      // Photos for the actual names, from the CRM's DJ profiles.
      const { data: photos } = await db.from("djs").select("display_name, photo_url").in("display_name", djMap.map((d) => d.display_name));
      for (const p of photos ?? []) djPhotos.set(String(p.display_name).toLowerCase(), (p.photo_url as string | null) ?? null);
    }
    // The extra sources are best-effort: a failure there never hides the venue's own bookings.
    const rows = (r: { data: unknown[] | null; error: unknown }) => (r.error ? [] : ((r.data ?? []) as unknown[]));

    type Block = { google_event_id: string; summary: string | null; starts_at: string; ends_at: string };
    const feedId = (googleId: string) => `gcal_${createHash("sha256").update(googleId).digest("hex").slice(0, 20)}`;
    const fromBlock = (b: Block) => {
      // Google all-day events are stored as whole UTC days (midnight to midnight); a 6 PM Chicago night also starts at 00:00Z, so length decides.
      const span = Date.parse(b.ends_at) - Date.parse(b.starts_at);
      const allDay = /^\d{4}-\d{2}-\d{2}$/.test(b.starts_at) || (/T00:00:00(\.0+)?(Z|\+00:?00)$/.test(b.starts_at) && span > 0 && span % 86400000 === 0);
      const date = allDay ? b.starts_at.slice(0, 10) : localDate(b.starts_at);
      return { id: feedId(b.google_event_id), date, starts_at: allDay ? null : b.starts_at, ends_at: allDay ? null : b.ends_at, label: nightLabel(date), status: "pending" as const, dj: null, source: "calendar" as const };
    };
    // Calendar nights from WordPress win (they know the DJ); pulled CRM calendar events fill any gaps.
    const mergeCal = <T extends { id: string }>(feed: T[], blocks: T[]) => { const seen = new Set(feed.map((f) => f.id)); return [...feed, ...blocks.filter((b) => !seen.has(b.id))]; };
    const uniqById = <T extends { id: string }>(list: T[]) => { const seen = new Set<string>(); return list.filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true))); };

    const sortKey = (e: { starts_at: string | null; date: string | null }) => (e.starts_at ? new Date(e.starts_at).toISOString() : `${e.date}T06:00:00.000Z`);
    const byStart = (a: { starts_at: string | null; date: string | null }, b: { starts_at: string | null; date: string | null }) => sortKey(a).localeCompare(sortKey(b));
    const monthProjects = uniqById([...((monthRes.data ?? []) as unknown as EventRow[]), ...(rows(namedMonthRes) as EventRow[])]).map(shape);
    const upcomingProjects = uniqById([...((upcomingRes.data ?? []) as unknown as EventRow[]), ...(rows(namedUpcomingRes) as EventRow[])]).map(shape);
    const monthCal = mergeCal(
      monthFeed.nights.filter((n) => n.date.startsWith(month)).map(fromCalendar),
      (rows(blocksMonthRes) as Block[]).map(fromBlock).filter((b) => b.date.startsWith(month))
    );
    const calUpcoming = mergeCal(
      upcomingFeed.nights.filter((n) => n.date >= today).map(fromCalendar),
      (rows(blocksUpRes) as Block[]).map(fromBlock).filter((b) => b.date >= today)
    );
    const monthEvents = [...monthProjects.filter((e) => e.date?.startsWith(month)), ...monthCal].sort(byStart);
    const upcoming = [...upcomingProjects, ...calUpcoming].sort(byStart).slice(0, 8);

    const lineupDjs = (lineupRes.data ?? [])
      .map((r) => r.djs as unknown as { id: string; display_name: string; photo_url: string | null; top_genres: string[] | null; specialties: string[] | null; event_types: string[] | null } | null)
      .filter((d): d is NonNullable<typeof d> => !!d);
    const lineup = lineupDjs
      .map((d) => {
        const dates = ((upcomingRes.data ?? []) as unknown as EventRow[]).filter((e) => e.dj_id === d.id && e.starts_at).map((e) => localDate(e.starts_at!));
        return {
          id: d.id,
          name: d.display_name,
          photo_url: d.photo_url,
          specialties: [...(d.top_genres ?? []), ...(d.specialties ?? [])].filter(Boolean).slice(0, 4),
          upcoming_dates: dates.slice(0, 3)
        };
      });
    // DJs playing this venue on the shared calendar who aren't linked in the CRM yet.
    const calDjs = new Map<string, { name: string; photo_url: string | null; dates: string[] }>();
    for (const n of calUpcoming) {
      if (!n.dj) continue;
      const dj = n.dj;
      const linked = lineup.find((x) => x.name.toLowerCase() === dj.name.toLowerCase());
      if (linked) {
        if (!linked.upcoming_dates.includes(n.date) && linked.upcoming_dates.length < 3) linked.upcoming_dates.push(n.date);
        continue;
      }
      const k = dj.name.toLowerCase();
      const cur = calDjs.get(k) ?? { name: dj.name, photo_url: dj.photo_url, dates: [] };
      if (cur.dates.length < 3) cur.dates.push(n.date);
      calDjs.set(k, cur);
    }
    for (const [k, d] of calDjs) lineup.push({ id: `cal_${k.replace(/[^a-z0-9]+/g, "_")}`, name: d.name, photo_url: d.photo_url, specialties: [], upcoming_dates: d.dates });
    lineup.sort((a, b) => a.name.localeCompare(b.name));

    const { calendar_names: _internal, ...publicVenue } = venue;
    void _internal;

    return NextResponse.json({
      preview,
      today,
      month,
      venues,
      venue: publicVenue,
      // Admin preview only: whether the shared-calendar link is working.
      ...(preview ? { calendarFeed: { names: names.length, status: names.length ? monthFeed.status : "no-names" } } : {}),
      overview: {
        upcomingNights: upcoming.length,
        assignedDjs: lineup.length,
        pendingApprovals: upcoming.filter((e) => e.status === "pending").length,
        holidayRequests: 0
      },
      upcoming,
      monthEvents,
      monthHolidays: holidaysInMonth(month),
      holidays: upcomingHolidays(today, 7).map((h) => ({ ...h, status: "none" as const })),
      lineup,
      messages: [] as never[],
      contact: {
        name: venue.dcdjs_contact_name,
        email: venue.dcdjs_contact_email,
        phone: venue.dcdjs_contact_phone
      }
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
