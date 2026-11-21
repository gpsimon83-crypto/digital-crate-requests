import { createHash } from "crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { calendarNights } from "@/lib/flyers/calendar-nights";
import { fold, type CalendarDjName } from "@/lib/venue/calendar-options";

type Db = ReturnType<typeof createAdminClient>;

/**
 * One DJ's own upcoming gigs, from everywhere the CRM knows about them:
 * projects they lead or crew on, venue nights on the shared DCDJ Google
 * Calendar that name them, and other Google Calendar entries (already pulled
 * into the CRM by the calendar sync) whose title names them. Read only.
 */
export type MyGig = {
  key: string;
  source: "project" | "venue_night" | "google";
  title: string;
  venue: string | null;
  date: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string | null;
  /** Where to open it (projects only; calendar entries live on Google). */
  href: string | null;
};

const TZ = "America/Chicago";
const localDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/** How this DJ may be written on the calendar: "DJ Peace", "Peace", plus any calendar nicknames mapped to them. */
export function calendarNamesFor(displayName: string, map: CalendarDjName[]): string[] {
  const out = new Set<string>();
  const add = (s: string) => {
    const t = s.trim();
    if (t.length >= 3) out.add(t);
  };
  add(displayName);
  add(displayName.replace(/^dj\.?\s+/i, ""));
  for (const m of map) if (fold(m.display_name) === fold(displayName)) add(m.calendar_name);
  return [...out];
}

/** Does a calendar title name this DJ as a whole word ("Peace @ Kyotes" yes, "Peaceful" no)? */
export function mentionsDj(summary: string | null | undefined, names: string[]): boolean {
  if (!summary) return false;
  const hay = ` ${fold(summary).replace(/[^a-z0-9']+/g, " ")} `;
  return names.some((n) => {
    const k = fold(n).replace(/[^a-z0-9']+/g, " ").trim();
    return !!k && hay.includes(` ${k} `);
  });
}

export async function myGigs(db: Db, dj: { id: string; display_name: string }, opts: { days?: number } = {}): Promise<{ gigs: MyGig[]; calendarConnected: boolean }> {
  const now = Date.now();
  const days = opts.days ?? 120;
  const since = new Date(now - 12 * 3600000).toISOString();
  const until = new Date(now + days * 86400000).toISOString();
  const today = localDate(new Date(now).toISOString());

  // 1. Projects: lead DJ or on the crew.
  const { data: crew } = await db.from("event_staff_assignments").select("event_id, status").eq("dj_id", dj.id);
  const crewIds = ((crew ?? []) as { event_id: string; status: string }[]).filter((r) => r.status !== "declined").map((r) => r.event_id);
  let q = db.from("events").select("id, title, starts_at, ends_at, status, venue_id, venue_name, venues(name)").gte("starts_at", since).lte("starts_at", until).order("starts_at").limit(200);
  q = crewIds.length ? q.or(`dj_id.eq.${dj.id},id.in.(${crewIds.join(",")})`) : q.eq("dj_id", dj.id);
  const { data: evRows } = await q;
  type Ev = { id: string; title: string | null; starts_at: string; ends_at: string | null; status: string; venue_id: string | null; venue_name: string | null; venues: { name: string } | { name: string }[] | null };
  const projects: MyGig[] = ((evRows ?? []) as unknown as Ev[])
    .filter((e) => e.status !== "declined" && e.status !== "cancelled")
    .map((e) => {
      const v = Array.isArray(e.venues) ? e.venues[0] : e.venues;
      return { key: `p:${e.id}`, source: "project", title: e.title || "Project", venue: v?.name ?? e.venue_name ?? null, date: localDate(e.starts_at), starts_at: e.starts_at, ends_at: e.ends_at, status: e.status, href: `/admin/events/${e.id}` };
    });
  const venueOf = new Map(((evRows ?? []) as unknown as Ev[]).map((e) => [e.id, e.venue_id]));
  const covered = new Set(projects.map((p) => `${venueOf.get(p.key.slice(2)) ?? ""}|${p.date}`));
  const projectDates = new Set(projects.map((p) => p.date));

  // 2. Venue nights on the shared calendar that name this DJ.
  const nights = await calendarNights(db, { fromDate: today, months: Math.min(3, Math.ceil(days / 31)) }).catch(() => []);
  const venueNights: MyGig[] = nights
    .filter((n) => n.dj_id === dj.id && !covered.has(`${n.venue_id}|${n.date}`))
    .map((n) => ({ key: n.id, source: "venue_night", title: n.title, venue: n.venue_name, date: n.date, starts_at: n.starts_at, ends_at: n.ends_at, status: null, href: null }));
  const nightIds = new Set(nights.map((n) => n.id.split(":").pop()));
  const nightDates = new Set(venueNights.map((n) => n.date));

  // 3. Any other Google Calendar entry naming this DJ (weddings, private parties written on the calendar).
  const { data: mapRows } = await db.from("calendar_dj_names").select("id, calendar_name, display_name");
  const names = calendarNamesFor(dj.display_name, (mapRows ?? []) as CalendarDjName[]);
  const terms = names.map((t) => t.replace(/[,()*%\\"'.:]/g, " ").replace(/\s+/g, " ").trim()).filter((t) => t.length >= 3);
  let google: MyGig[] = [];
  if (terms.length) {
    const { data: blocks } = await db
      .from("external_calendar_busy_blocks")
      .select("google_event_id, summary, starts_at, ends_at")
      .or(terms.map((t) => `summary.ilike.*${t}*`).join(","))
      .gte("ends_at", since)
      .lt("starts_at", until)
      .order("starts_at")
      .limit(200);
    google = ((blocks ?? []) as { google_event_id: string; summary: string | null; starts_at: string; ends_at: string }[])
      .filter((b) => mentionsDj(b.summary, names))
      .map((b): MyGig => {
        const span = Date.parse(b.ends_at) - Date.parse(b.starts_at);
        const allDay = /T00:00:00(\.0+)?(Z|\+00:?00)$/.test(b.starts_at) && span > 0 && span % 86400000 === 0;
        const id = `g${createHash("sha256").update(b.google_event_id).digest("hex").slice(0, 20)}`;
        return { key: id, source: "google", title: (b.summary ?? "Calendar entry").slice(0, 120), venue: null, date: allDay ? b.starts_at.slice(0, 10) : localDate(b.starts_at), starts_at: allDay ? null : b.starts_at, ends_at: allDay ? null : b.ends_at, status: null, href: null };
      })
      // Already shown as a venue night (same entry) or as a project on that day.
      .filter((g) => !nightIds.has(g.key) && !nightDates.has(g.date) && !projectDates.has(g.date));
  }

  const { data: conn } = await db.from("calendar_connection").select("id").eq("id", true).maybeSingle();
  const gigs = [...projects, ...venueNights, ...google].sort((a, b) => (a.starts_at ?? `${a.date}T12:00:00Z`).localeCompare(b.starts_at ?? `${b.date}T12:00:00Z`));
  return { gigs, calendarConnected: !!conn };
}
