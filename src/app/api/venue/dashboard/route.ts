import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireVenueAccess } from "@/lib/venue/server";
import { holidaysInMonth, upcomingHolidays } from "@/lib/venue/holidays";

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

    const win = monthWindow(month);
    const [monthRes, upcomingRes, lineupRes] = await Promise.all([
      db.from("events").select(cols).eq("venue_id", venue.id).gte("starts_at", win.from).lt("starts_at", win.to).order("starts_at"),
      db.from("events").select(cols).eq("venue_id", venue.id).gte("starts_at", new Date().toISOString()).neq("status", "declined").order("starts_at").limit(8),
      db.from("venue_djs").select("djs(id, display_name, photo_url, top_genres, specialties, event_types)").eq("venue_id", venue.id)
    ]);
    if (monthRes.error) throw monthRes.error;
    if (upcomingRes.error) throw upcomingRes.error;
    if (lineupRes.error) throw lineupRes.error;

    const monthEvents = ((monthRes.data ?? []) as unknown as EventRow[]).map(shape).filter((e) => e.date?.startsWith(month));
    const upcoming = ((upcomingRes.data ?? []) as unknown as EventRow[]).map(shape);

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
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const { calendar_names: _internal, ...publicVenue } = venue;
    void _internal;

    return NextResponse.json({
      preview,
      today,
      month,
      venues,
      venue: publicVenue,
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
