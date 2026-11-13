import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireVenueAccess } from "@/lib/venue/server";
import { holidaysInMonth, upcomingHolidays } from "@/lib/venue/holidays";
import { fetchVenueNights, type CalendarNight } from "@/lib/venue/calendar-feed";
import { normalizeNights } from "@/lib/venue/types";

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
    const fromCalendar = (n: CalendarNight) => ({
      id: n.id,
      date: n.date,
      starts_at: n.starts_at,
      ends_at: n.ends_at,
      label: nightLabel(n.date),
      status: (n.state === "confirmed" ? "confirmed" : "pending") as "confirmed" | "pending",
      dj: n.dj,
      source: "calendar" as const
    });
    const names = venue.calendar_names ?? [];

    const win = monthWindow(month);
    const [monthFeed, upcomingFeed] = await Promise.all([
      fetchVenueNights(names, month, 1),
      fetchVenueNights(names, today.slice(0, 7), 3)
    ]);
    const [monthRes, upcomingRes, lineupRes] = await Promise.all([
      db.from("events").select(cols).eq("venue_id", venue.id).gte("starts_at", win.from).lt("starts_at", win.to).order("starts_at"),
      db.from("events").select(cols).eq("venue_id", venue.id).gte("starts_at", new Date().toISOString()).neq("status", "declined").order("starts_at").limit(8),
      db.from("venue_djs").select("djs(id, display_name, photo_url, top_genres, specialties, event_types)").eq("venue_id", venue.id)
    ]);
    if (monthRes.error) throw monthRes.error;
    if (upcomingRes.error) throw upcomingRes.error;
    if (lineupRes.error) throw lineupRes.error;

    const sortKey = (e: { starts_at: string | null; date: string | null }) => (e.starts_at ? new Date(e.starts_at).toISOString() : `${e.date}T06:00:00.000Z`);
    const byStart = (a: { starts_at: string | null; date: string | null }, b: { starts_at: string | null; date: string | null }) => sortKey(a).localeCompare(sortKey(b));
    const monthEvents = [
      ...((monthRes.data ?? []) as unknown as EventRow[]).map(shape).filter((e) => e.date?.startsWith(month)),
      ...monthFeed.nights.filter((n) => n.date.startsWith(month)).map(fromCalendar)
    ].sort(byStart);
    const calUpcoming = upcomingFeed.nights.filter((n) => n.date >= today).map(fromCalendar);
    const upcoming = [...((upcomingRes.data ?? []) as unknown as EventRow[]).map(shape), ...calUpcoming].sort(byStart).slice(0, 8);

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
      if (lineup.some((l) => l.name.toLowerCase() === n.dj!.name.toLowerCase())) {
        const l = lineup.find((x) => x.name.toLowerCase() === n.dj!.name.toLowerCase())!;
        if (!l.upcoming_dates.includes(n.date) && l.upcoming_dates.length < 3) l.upcoming_dates.push(n.date);
        continue;
      }
      const k = n.dj.name.toLowerCase();
      const cur = calDjs.get(k) ?? { name: n.dj.name, photo_url: n.dj.photo_url, dates: [] };
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
