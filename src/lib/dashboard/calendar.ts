import { dayKey, eventsByDay, type DashEvent } from "@/lib/dashboard/overview";

/**
 * Date and grouping logic for the event calendar card (no React here, so it
 * can be tested). Dates are the viewer's local days, the same as before: an
 * event shows on the day it starts. Weeks start on Sunday (the app has no
 * week-start setting).
 */

/** The three kinds the calendar tells apart. Everything that isn't an inquiry or an away note is booked (declined is left out upstream). */
export type CalKind = "booked" | "inquiry" | "away";
export const calKind = (status: string): CalKind => (status === "inquiry" ? "inquiry" : status === "away" ? "away" : "booked");
export const CAL_KIND_LABEL: Record<CalKind, string> = { booked: "Booked", inquiry: "Inquiry", away: "Away" };

/** "2026-11-22" → local Date at midnight. */
export function fromKey(k: string): Date {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Move a day key by whole days (calendar days, so daylight-saving changes don't shift it). */
export function addDaysKey(k: string, days: number): string {
  const d = fromKey(k);
  return dayKey(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

/** First day of the month a key falls in. */
export const monthOfKey = (k: string): Date => {
  const d = fromKey(k);
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

export const sameMonth = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();

/** The same day number in another month, clamped to its length (Jan 31 → Feb 28/29). */
export function sameDayIn(month: Date, k: string): string {
  const day = fromKey(k).getDate();
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return dayKey(new Date(month.getFullYear(), month.getMonth(), Math.min(day, last)));
}

/** Move by whole months, keeping the day number where it exists. */
export function addMonthsKey(k: string, months: number): string {
  const d = fromKey(k);
  return sameDayIn(new Date(d.getFullYear(), d.getMonth() + months, 1), k);
}

/** Arrow-key moves inside the grid (Home/End are the week's ends, Sunday first). */
export function keyMove(k: string, key: string): string | null {
  const dow = fromKey(k).getDay();
  switch (key) {
    case "ArrowLeft":
      return addDaysKey(k, -1);
    case "ArrowRight":
      return addDaysKey(k, 1);
    case "ArrowUp":
      return addDaysKey(k, -7);
    case "ArrowDown":
      return addDaysKey(k, 7);
    case "Home":
      return addDaysKey(k, -dow);
    case "End":
      return addDaysKey(k, 6 - dow);
    case "PageUp":
      return addMonthsKey(k, -1);
    case "PageDown":
      return addMonthsKey(k, 1);
    default:
      return null;
  }
}

/** The events of one displayed month, by day, earliest first (for Agenda view). */
export function monthAgenda(events: DashEvent[], month: Date): { key: string; events: DashEvent[] }[] {
  return [...eventsByDay(events).entries()]
    .filter(([k]) => sameMonth(fromKey(k), month))
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([key, list]) => ({ key, events: list }));
}

/** "6:00 PM – 7:00 PM", "6:00 PM", or "All day". Only uses times the event actually has. */
export function timeRange(e: Pick<DashEvent, "starts_at" | "all_day"> & { ends_at?: string | null }): string {
  if (e.all_day || !e.starts_at) return "All day";
  const t = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  const start = t(e.starts_at);
  if (!e.ends_at || Date.parse(e.ends_at) <= Date.parse(e.starts_at)) return start;
  const sameDay = dayKey(new Date(e.ends_at)) === dayKey(new Date(e.starts_at));
  const end = sameDay ? t(e.ends_at) : `${new Date(e.ends_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}, ${t(e.ends_at)}`;
  return `${start} – ${end}`;
}

/** Project records have UUID ids; calendar entries (Google, venue nights) don't and have no page of their own. */
export const isProjectId = (id: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
