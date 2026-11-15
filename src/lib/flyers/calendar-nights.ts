/**
 * Venue nights from the shared DCDJ Google Calendar, as things a flyer can
 * be made for (alongside CRM events). Read only: nothing here writes to the
 * calendar, the venue or any event.
 *
 * Same sources as the venue portal's calendar: the WordPress feed (knows
 * the DJ) first, then Google Calendar events already pulled into the CRM.
 * Only venues with a portal are searched.
 */
import { createHash } from "crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { fetchVenueNights } from "@/lib/venue/calendar-feed";
import { resolveDjName, venueSearchNames, type CalendarDjName } from "@/lib/venue/calendar-options";
import { locationSearchNames, normalizeLocations } from "@/lib/venue/locations";
import { normalizeNights } from "@/lib/venue/types";

type Db = ReturnType<typeof createAdminClient>;

export type CalendarNightRef = {
  /** "cal:<venueId>:<YYYY-MM-DD>:<calendar id>" — what the flyer stores and the pickers send. */
  id: string;
  venue_id: string;
  venue_name: string;
  date: string;
  starts_at: string | null;
  ends_at: string | null;
  title: string;
  dj_id: string | null;
  dj_name: string | null;
};

const TZ = "America/Chicago";
const KEY = /^cal:([0-9a-f-]{36}):(\d{4}-\d{2}-\d{2}):([A-Za-z0-9_]{1,40})$/;

export const isCalendarKey = (v: unknown): v is string => typeof v === "string" && KEY.test(v);
export function parseCalendarKey(v: string): { venueId: string; date: string; nightId: string } | null {
  const m = KEY.exec(v);
  return m ? { venueId: m[1], date: m[2], nightId: m[3] } : null;
}

/** Wall-clock time in Chicago on a date ("21:30" on 2026-11-25) as an ISO instant. */
export function chicagoInstant(date: string, hhmm: string): string {
  const [h, mi] = hhmm.split(":").map(Number);
  // Try both possible offsets (CST / CDT) and keep the one that reads back as that wall time.
  for (const off of [6, 5]) {
    const d = new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h + off, mi));
    const back = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(d);
    if (back === `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`) return d.toISOString();
  }
  return new Date(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h + 6, mi)).toISOString();
}

const localDate = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const monthOf = (date: string) => date.slice(0, 7);

type VenueCal = { id: string; name: string; calendar_names: string[] | null; recurring_nights: unknown; locations?: unknown };
type Block = { google_event_id: string; summary: string | null; starts_at: string; ends_at: string };

/**
 * Calendar nights for portal venues from `fromDate` for `months` months.
 * `venueIds` limits the venues searched (one venue when re-checking a flyer's night).
 */
export async function calendarNights(db: Db, opts: { fromDate: string; months?: number; venueIds?: string[] }): Promise<CalendarNightRef[]> {
  const months = Math.max(1, Math.min(3, opts.months ?? 3));
  let q = db.from("venues").select("*").eq("portal_enabled", true);
  if (opts.venueIds?.length) q = q.in("id", opts.venueIds);
  const { data: vRows, error } = await q;
  if (error) return [];
  const venues = (vRows ?? []) as VenueCal[];
  if (!venues.length) return [];

  const { data: mapRows } = await db.from("calendar_dj_names").select("id, calendar_name, display_name");
  const djMap = (mapRows ?? []) as CalendarDjName[];
  const { data: djRows } = await db.from("djs").select("id, display_name");
  const djByName = new Map(((djRows ?? []) as { id: string; display_name: string }[]).map((d) => [d.display_name.toLowerCase(), d]));
  const djFor = (...texts: (string | null | undefined)[]) => {
    const mapped = resolveDjName(djMap, ...texts);
    const name = mapped?.display_name ?? texts.find((t) => t && djByName.has(t.toLowerCase())) ?? null;
    const prof = name ? djByName.get(name.toLowerCase()) : undefined;
    return { dj_id: prof?.id ?? null, dj_name: prof?.display_name ?? name ?? null };
  };

  const fromIso = `${opts.fromDate}T00:00:00Z`;
  const until = new Date(Date.parse(fromIso) + months * 31 * 86400000).toISOString();
  const out: CalendarNightRef[] = [];

  await Promise.all(
    venues.map(async (v) => {
      const recurring = normalizeNights(v.recurring_nights);
      const names = [...new Set([...locationSearchNames(normalizeLocations(v.locations)), ...venueSearchNames(v.name, v.calendar_names ?? [], djMap)])].slice(0, 20);
      if (!names.length) return;
      const forDay = (date: string) => recurring.find((r) => r.day === new Date(`${date}T12:00:00Z`).getUTCDay());
      const make = (nightId: string, date: string, startsAt: string | null, endsAt: string | null, dj: { dj_id: string | null; dj_name: string | null }): CalendarNightRef => {
        const rec = forDay(date);
        // All-day calendar nights get the venue's usual hours for that weekday.
        const starts = startsAt ?? (rec ? chicagoInstant(date, rec.start) : null);
        let ends = endsAt ?? null;
        if (!ends && rec && starts) {
          ends = chicagoInstant(date, rec.end);
          if (Date.parse(ends) <= Date.parse(starts)) ends = new Date(Date.parse(ends) + 86400000).toISOString();
        }
        return { id: `cal:${v.id}:${date}:${nightId}`, venue_id: v.id, venue_name: v.name, date, starts_at: starts, ends_at: ends, title: rec?.label || `${v.name} night`, ...dj };
      };

      const feed = await fetchVenueNights(names, monthOf(opts.fromDate), months);
      const seen = new Set<string>();
      for (const n of feed.nights) {
        if (n.date < opts.fromDate) continue;
        seen.add(n.date);
        out.push(make(n.id, n.date, n.all_day ? null : n.starts_at, n.all_day ? null : n.ends_at, djFor(n.dj_text, n.dj?.name)));
      }
      // Google Calendar events already in the CRM fill dates the feed didn't return.
      const terms = [...new Set(names.map((t) => t.replace(/[,()*%\\"'.:]/g, " ").replace(/\s+/g, " ").trim()).filter((t) => t.length >= 3))].slice(0, 12);
      if (!terms.length) return;
      const { data: blocks } = await db
        .from("external_calendar_busy_blocks")
        .select("google_event_id, summary, starts_at, ends_at")
        .or(terms.map((t) => `summary.ilike.*${t}*`).join(","))
        .gte("starts_at", fromIso)
        .lt("starts_at", until)
        .order("starts_at")
        .limit(120);
      for (const b of (blocks ?? []) as Block[]) {
        const span = Date.parse(b.ends_at) - Date.parse(b.starts_at);
        const allDay = /T00:00:00(\.0+)?(Z|\+00:?00)$/.test(b.starts_at) && span > 0 && span % 86400000 === 0;
        const date = allDay ? b.starts_at.slice(0, 10) : localDate(b.starts_at);
        if (date < opts.fromDate || seen.has(date)) continue;
        seen.add(date);
        const id = `g${createHash("sha256").update(b.google_event_id).digest("hex").slice(0, 20)}`;
        out.push(make(id, date, allDay ? null : b.starts_at, allDay ? null : b.ends_at, djFor(b.summary)));
      }
    })
  );
  return out.sort((a, b) => (a.starts_at ?? a.date).localeCompare(b.starts_at ?? b.date));
}

/** Looks a calendar night up again from its key (never trusts what the browser sent about it). */
export async function findCalendarNight(db: Db, key: string): Promise<CalendarNightRef | null> {
  const k = parseCalendarKey(key);
  if (!k) return null;
  const nights = await calendarNights(db, { fromDate: k.date, months: 1, venueIds: [k.venueId] });
  return nights.find((n) => n.id === key) ?? nights.find((n) => n.date === k.date) ?? null;
}
