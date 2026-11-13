import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireVenueAccess } from "@/lib/venue/server";
import { holidaysInMonth, upcomingHolidays } from "@/lib/venue/holidays";
import { fetchVenueNights, type CalendarNight } from "@/lib/venue/calendar-feed";
import { normalizeNights } from "@/lib/venue/types";
import { loadLocations, locationForMatched, locationForText, locationSearchNames, toPublicLocations } from "@/lib/venue/locations";
import { PLAN_COLUMNS, missingPlansTable, toNightPlan, type NightPlan } from "@/lib/venue/night-plans";
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
  venue_name?: string | null;
  djs: { id?: string; display_name?: string; photo_url?: string | null; hero_settings?: unknown } | null;
};

type DjRow = { id: string; display_name: string; photo_url: string | null; bio?: string | null; top_genres: string[] | null; specialties?: string[] | null; event_types: string[] | null; hero_settings?: unknown };

/**
 * A saved crop point for a DJ's photo (from their request-page hero settings),
 * or null when it's still the default, so portraits fall back to a face-friendly crop.
 */
function photoFocus(hero: unknown): { x: number; y: number } | null {
  if (!hero || typeof hero !== "object") return null;
  const h = hero as Record<string, unknown>;
  const x = Number(h.xPosition), y = Number(h.yPosition);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x === 75 && y === 50) return null; // the untouched default
  return { x: Math.max(0, Math.min(100, x)), y: Math.max(0, Math.min(100, y)) };
}

function eventTypeLabel(type: string | null, category: string | null) {
  const t = (type ?? "").trim();
  if (t) return t;
  return category ? `${category[0].toUpperCase()}${category.slice(1)} event` : "Private event";
}

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
    // Several places under one venue (e.g. North 48 Cedarburg / Oconomowoc): every night is tagged with its location.
    const { locations } = await loadLocations(db, venue.id);
    const shape = (e: EventRow) => ({
      id: e.id,
      date: e.starts_at ? localDate(e.starts_at) : null,
      starts_at: e.starts_at,
      ends_at: e.ends_at,
      label: eventTypeLabel(e.event_type, e.event_category),
      status: e.status === "confirmed" || e.status === "live" || e.status === "ended" ? "confirmed" : e.status === "declined" ? "cancelled" : "pending",
      dj: e.djs?.display_name ? { id: e.djs.id ?? e.dj_id ?? null, name: e.djs.display_name, photo_url: e.djs.photo_url ?? null, focus: photoFocus(e.djs.hero_settings) } : null,
      source: "booking" as const,
      location_id: locationForText(locations, e.venue_name)
    });
    const cols = "id, event_category, event_type, starts_at, ends_at, status, dj_id, venue_name, djs(id, display_name, photo_url, hero_settings)";

    // Nights from the shared DCDJ calendar (via the WordPress site) for this venue's calendar names.
    const recurring = normalizeNights(venue.recurring_nights);
    const nightLabel = (date: string) => {
      const day = new Date(`${date}T12:00:00Z`).getUTCDay();
      return recurring.find((r) => r.day === day && r.label)?.label || "DCDJs night";
    };
    const djMap: CalendarDjName[] = [];
    // CRM DJ profiles by lowercased display name (for calendar nights mapped to an actual name).
    const djProfiles = new Map<string, DjRow>();
    const fromCalendar = (n: CalendarNight) => {
      // Your list wins: "J Prime" on the calendar shows as the actual name you gave that DJ.
      const mapped = resolveDjName(djMap, n.dj_text, n.dj?.name);
      const name = mapped?.display_name ?? n.dj?.name ?? null;
      const prof = name ? djProfiles.get(name.toLowerCase()) : undefined;
      const dj = name
        ? { id: prof?.id ?? null, name, photo_url: prof?.photo_url ?? n.dj?.photo_url ?? null, focus: photoFocus(prof?.hero_settings) }
        : null;
      return {
        id: n.id,
        date: n.date,
        starts_at: n.starts_at,
        ends_at: n.ends_at,
        label: nightLabel(n.date),
        status: (n.state === "confirmed" ? "confirmed" : "pending") as "confirmed" | "pending",
        dj,
        source: "calendar" as const,
        location_id: locationForMatched(locations, n.matched)
      };
    };
    // DJs as written on the calendar → actual names (also used to skip DJ names saved as venue names).
    const { data: djMapRows, error: djMapErr } = await db.from("calendar_dj_names").select("id, calendar_name, display_name");
    const djMapLoaded = (djMapErr ? [] : (djMapRows ?? [])) as CalendarDjName[];
    // The venue's own name ("Casey Keys" → also "Casey Key") plus saved calendar names that aren't DJs.
    // Location names go first (longest first) so the calendar credits each night to its location.
    const names = [...new Set([...locationSearchNames(locations), ...venueSearchNames(venue.name, venue.calendar_names ?? [], djMapLoaded)])].slice(0, 20);
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
      db.from("events").select(cols).eq("venue_id", venue.id).gte("starts_at", nowIso).neq("status", "declined").order("starts_at").limit(40),
      db.from("venue_djs").select("djs(id, display_name, photo_url, bio, top_genres, specialties, event_types, hero_settings)").eq("venue_id", venue.id),
      // CRM projects not linked to the venue record but entered with its name (e.g. website inquiries once booked).
      nameMatch
        ? db.from("events").select(cols).is("venue_id", null).or(nameMatch).not("status", "in", "(inquiry,declined)").gte("starts_at", win.from).lt("starts_at", win.to).order("starts_at")
        : none,
      nameMatch
        ? db.from("events").select(cols).is("venue_id", null).or(nameMatch).not("status", "in", "(inquiry,declined)").gte("starts_at", nowIso).order("starts_at").limit(40)
        : none,
      // Google Calendar events already pulled into the cratesdjs.com Calendar page.
      summaryMatch
        ? db.from("external_calendar_busy_blocks").select("google_event_id, summary, starts_at, ends_at").or(summaryMatch).gte("starts_at", win.from).lt("starts_at", win.to).order("starts_at")
        : none,
      summaryMatch
        ? db.from("external_calendar_busy_blocks").select("google_event_id, summary, starts_at, ends_at").or(summaryMatch).gte("ends_at", nowIso).lt("starts_at", upTo).order("starts_at").limit(40)
        : none
    ]);
    if (monthRes.error) throw monthRes.error;
    if (upcomingRes.error) throw upcomingRes.error;
    if (lineupRes.error) throw lineupRes.error;
    djMap.push(...djMapLoaded);
    // Profiles for DJs named on the calendar: your DJ list's actual names plus names the website matched.
    const calNames = [...new Set([...djMap.map((d) => d.display_name), ...[...monthFeed.nights, ...upcomingFeed.nights].map((n) => n.dj?.name).filter((n): n is string => !!n)])];
    if (calNames.length) {
      const { data: profs } = await db.from("djs").select("id, display_name, photo_url, bio, top_genres, specialties, event_types, hero_settings").in("display_name", calNames.slice(0, 60));
      for (const p of (profs ?? []) as DjRow[]) djProfiles.set(String(p.display_name).toLowerCase(), p);
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
      return { id: feedId(b.google_event_id), date, starts_at: allDay ? null : b.starts_at, ends_at: allDay ? null : b.ends_at, label: nightLabel(date), status: "pending" as const, dj: null as null | { id: string | null; name: string; photo_url: string | null; focus: { x: number; y: number } | null }, source: "calendar" as const, location_id: locationForText(locations, b.summary) };
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
    const upcomingAll = [...upcomingProjects, ...calUpcoming].sort(byStart).slice(0, 40);

    // DJ lineup: DJs linked to the venue in the CRM, plus DJs booked here on the calendar or in bookings.
    type LineupDj = { id: string; profile_id: string | null; name: string; photo_url: string | null; focus: { x: number; y: number } | null; bio: string | null; genres: string[]; event_types: string[]; upcoming_dates: string[]; dates: { date: string; location_id: string | null }[] };
    const lineup: LineupDj[] = [];
    const fromProfile = (d: DjRow): LineupDj => ({
      id: d.id,
      profile_id: d.id,
      name: d.display_name,
      photo_url: d.photo_url,
      focus: photoFocus(d.hero_settings),
      bio: d.bio ? String(d.bio).slice(0, 600) : null,
      genres: [...(d.top_genres ?? []), ...(d.specialties ?? [])].filter(Boolean).slice(0, 6),
      event_types: (d.event_types ?? []).filter(Boolean).slice(0, 6),
      upcoming_dates: [],
      dates: []
    });
    for (const r of lineupRes.data ?? []) {
      const d = r.djs as unknown as DjRow | null;
      if (d) lineup.push(fromProfile(d));
    }
    for (const e of upcomingAll) {
      if (!e.dj || !e.date) continue;
      const k = e.dj.name.toLowerCase();
      let l = lineup.find((x) => (e.dj!.id && x.profile_id === e.dj!.id) || x.name.toLowerCase() === k);
      if (!l) {
        const prof = djProfiles.get(k);
        l = prof ? fromProfile(prof) : { id: `cal_${k.replace(/[^a-z0-9]+/g, "_")}`, profile_id: null, name: e.dj.name, photo_url: e.dj.photo_url, focus: e.dj.focus, bio: null, genres: [], event_types: [], upcoming_dates: [], dates: [] };
        lineup.push(l);
      }
      if (!l.upcoming_dates.includes(e.date) && l.upcoming_dates.length < 6) l.upcoming_dates.push(e.date);
      if (l.dates.length < 16 && !l.dates.some((x) => x.date === e.date && x.location_id === e.location_id)) l.dates.push({ date: e.date, location_id: e.location_id });
    }
    // DJs with a next date first, soonest first; then the rest by name.
    lineup.sort((a, b) => (a.upcoming_dates[0] ?? "9999").localeCompare(b.upcoming_dates[0] ?? "9999") || a.name.localeCompare(b.name));

    // Holidays: status comes from actual bookings on that date (requested = pending, booked = confirmed).
    const holidays = upcomingHolidays(today, 7).map((h) => {
      const on = upcomingAll.filter((e) => e.date === h.date);
      const status = on.some((e) => e.status === "confirmed") ? ("confirmed" as const) : on.some((e) => e.status === "pending") ? ("pending" as const) : ("none" as const);
      return { ...h, status };
    });

    // The venue's night plans (occasion, drink specials, DJ requests) from this month or today on.
    const plansFrom = `${month}-01` < today ? `${month}-01` : today;
    // location_id arrives with migration 0049; before that, plans are read without it.
    const readPlans = (columns: string) => db.from("venue_night_plans").select(columns).eq("venue_id", venue.id).gte("night_date", plansFrom).order("night_date").limit(200);
    let plansRes = (await readPlans(`${PLAN_COLUMNS}, location_id`)) as { data: unknown[] | null; error: { code?: string; message?: string } | null };
    if (plansRes.error && !missingPlansTable(plansRes.error)) plansRes = (await readPlans(PLAN_COLUMNS)) as typeof plansRes;
    const plansReady = !missingPlansTable(plansRes.error);
    const plans: NightPlan[] = plansRes.error ? [] : (plansRes.data ?? []).map((r) => toNightPlan(r as Record<string, unknown>));

    const { calendar_names: _internal, ...publicVenue } = venue;
    void _internal;

    return NextResponse.json({
      preview,
      today,
      month,
      venues,
      venue: { ...publicVenue, locations: toPublicLocations(locations) },
      // Admin preview only: whether the shared-calendar link is working.
      ...(preview ? { calendarFeed: { names: names.length, status: names.length ? monthFeed.status : "no-names" } } : {}),
      overview: {
        upcomingNights: upcomingAll.length,
        assignedDjs: lineup.length,
        pendingApprovals: upcomingAll.filter((e) => e.status === "pending").length,
        // Upcoming holiday nights that already have a booking request or booking on them.
        holidayRequests: holidays.filter((h) => h.status !== "none").length
      },
      upcoming: upcomingAll,
      monthEvents,
      monthHolidays: holidaysInMonth(month),
      holidays,
      lineup,
      plans,
      // Venue managers can add plans; the staff preview is read-only.
      planning: { ready: plansReady, canEdit: !preview && plansReady },
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
