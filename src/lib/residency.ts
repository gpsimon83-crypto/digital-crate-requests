/**
 * Recurring Bar / Club bookings — pure logic (no database). A residency is
 * one recurring night at a venue; every date is a gig with its own hours,
 * DJ, notes, coverage, outcome and recap.
 *
 * Dates are YYYY-MM-DD strings in the residency's time zone; times are
 * "HH:MM" (24h). Nothing here ever plans a change to a gig before
 * `today`, so history is never rewritten.
 */

export type Pattern = "weekly" | "monthly" | "manual";
export type Coverage = "unassigned" | "awaiting" | "confirmed";
export type Outcome = "scheduled" | "played" | "canceled";

export interface Schedule {
  pattern: Pattern;
  weekday: number | null; // 0 = Sunday
  weeks: number[]; // monthly: 1-4, 5 = last
  start_time: string;
  end_time: string;
  starts_on: string;
  ends_on: string | null;
}

export interface Gig {
  id: string;
  slot_date: string;
  gig_date: string;
  start_time: string;
  end_time: string;
  dj_id: string | null;
  coverage: Coverage;
  outcome: Outcome;
  notes: string | null;
  source: "schedule" | "manual";
  detached: boolean;
  off_schedule: boolean;
  change_note?: string | null;
}

export const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const ORD = ["", "1st", "2nd", "3rd", "4th", "last"];
/** How far ahead dates are generated. */
export const HORIZON_DAYS = 120;

const pad = (n: number) => String(n).padStart(2, "0");
const toDate = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};
const fromDate = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
export const addDays = (s: string, n: number) => {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fromDate(d);
};
export const weekdayOf = (s: string) => toDate(s).getUTCDay();
export const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && fromDate(toDate(s)) === s;
export const isTime = (s: unknown): s is string => typeof s === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
export const hhmm = (t: string) => t.slice(0, 5);

/** Today's date in a time zone. */
export function todayIn(tz: string, now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz || "America/Chicago" }).format(now);
}

/** Which week of the month a date falls in (1-5), and whether it's the last such weekday. */
function weekOfMonth(s: string) {
  const d = toDate(s);
  const nth = Math.floor((d.getUTCDate() - 1) / 7) + 1;
  const next = new Date(d);
  next.setUTCDate(d.getUTCDate() + 7);
  return { nth, last: next.getUTCMonth() !== d.getUTCMonth() };
}

/** Does a date fall on the schedule? (Ignores the start/end range.) */
export function onPattern(s: Schedule, date: string) {
  if (s.pattern === "manual" || s.weekday == null) return false;
  if (weekdayOf(date) !== s.weekday) return false;
  if (s.pattern === "weekly") return true;
  const { nth, last } = weekOfMonth(date);
  return s.weeks.includes(nth) || (last && s.weeks.includes(5));
}

/** Schedule dates from `from` to `to` (inclusive), inside the residency's start/end. */
export function scheduleDates(s: Schedule, from: string, to: string): string[] {
  if (s.pattern === "manual" || s.weekday == null) return [];
  let start = from > s.starts_on ? from : s.starts_on;
  const end = s.ends_on && s.ends_on < to ? s.ends_on : to;
  const out: string[] = [];
  // first matching weekday
  start = addDays(start, (s.weekday - weekdayOf(start) + 7) % 7);
  for (let d = start; d <= end; d = addDays(d, 7)) if (onPattern(s, d)) out.push(d);
  return out;
}

/** "12–5 PM", "9 PM–1 AM", "8:30–11 PM". */
export function fmtHours(start: string, end: string) {
  const part = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return { h12: h % 12 || 12, m, ap: h >= 12 ? "PM" : "AM" };
  };
  const a = part(start);
  const b = part(end);
  const show = (p: ReturnType<typeof part>) => `${p.h12}${p.m ? `:${pad(p.m)}` : ""}`;
  return a.ap === b.ap ? `${show(a)}–${show(b)} ${b.ap}` : `${show(a)} ${a.ap}–${show(b)} ${b.ap}`;
}

/** "Weekly", "1st & 3rd Saturday", "Selected dates". */
export function recurrenceLabel(s: Pick<Schedule, "pattern" | "weekday" | "weeks">) {
  if (s.pattern === "manual" || s.weekday == null) return "Selected dates";
  if (s.pattern === "weekly") return "Weekly";
  const weeks = [...s.weeks].sort().map((w) => ORD[w]);
  const list = weeks.length > 1 ? `${weeks.slice(0, -1).join(", ")} & ${weeks.at(-1)}` : (weeks[0] ?? "");
  return `${list} ${DAYS[s.weekday]}`;
}
/** "Sundays · Weekly" for longer places. */
export function recurrenceLong(s: Pick<Schedule, "pattern" | "weekday" | "weeks">) {
  if (s.pattern === "weekly" && s.weekday != null) return `Every ${DAYS[s.weekday]}`;
  if (s.pattern === "monthly") return `${recurrenceLabel(s)} of the month`;
  return "Dates added one at a time";
}

export function validateSchedule(input: Partial<Schedule>): { value: Schedule } | { error: string } {
  const pattern = input.pattern;
  if (pattern !== "weekly" && pattern !== "monthly" && pattern !== "manual") return { error: "Choose how often it repeats." };
  const weekday = input.weekday == null ? null : Number(input.weekday);
  if (pattern !== "manual" && (weekday == null || !Number.isInteger(weekday) || weekday < 0 || weekday > 6)) return { error: "Choose the night of the week." };
  const weeks = Array.from(new Set((input.weeks ?? []).map(Number))).filter((w) => [1, 2, 3, 4, 5].includes(w)).sort();
  if (pattern === "monthly" && !weeks.length) return { error: "Choose which weeks of the month." };
  if (!isTime(input.start_time) || !isTime(input.end_time)) return { error: "Enter the set start and end times." };
  if (input.start_time === input.end_time) return { error: "Start and end can't be the same time." };
  if (!isDate(input.starts_on)) return { error: "Enter the first date." };
  if (input.ends_on != null && input.ends_on !== "" && (!isDate(input.ends_on) || input.ends_on < input.starts_on)) return { error: "The end date has to be after the first date." };
  return {
    value: { pattern, weekday: pattern === "manual" ? weekday : weekday, weeks: pattern === "monthly" ? weeks : [], start_time: input.start_time, end_time: input.end_time, starts_on: input.starts_on, ends_on: input.ends_on || null }
  };
}

/** New gigs to create: schedule dates from today to the horizon that have no gig yet. Idempotent. */
export function datesToGenerate(s: Schedule, existingSlots: Iterable<string>, today: string, horizon = HORIZON_DAYS) {
  const have = new Set(existingSlots);
  return scheduleDates(s, today, addDays(today, horizon)).filter((d) => !have.has(d));
}

export type ChangePlan = {
  remove: string[]; // gig ids: future, generated, untouched, nothing on them
  keepOff: string[]; // gig ids: no longer on the schedule but kept (DJ or notes on them)
  retime: { id: string; start_time: string; end_time: string; change_note: string | null }[];
};

/**
 * "This and future gigs": apply a schedule edit from `from` on. Past gigs,
 * gigs edited "this gig only", manual dates, played or canceled gigs are
 * left alone. Gigs that drop off the schedule are deleted only when nothing
 * is on them; otherwise they're kept and marked off-schedule for staff.
 * Confirmed DJs stay confirmed; they get a note when the hours change.
 */
export function planScheduleChange(next: Schedule, gigs: Gig[], from: string): ChangePlan {
  const plan: ChangePlan = { remove: [], keepOff: [], retime: [] };
  const inRange = (d: string) => d >= next.starts_on && (!next.ends_on || d <= next.ends_on);
  for (const g of gigs) {
    if (g.gig_date < from || g.detached || g.source !== "schedule" || g.outcome !== "scheduled") continue;
    if (!(onPattern(next, g.slot_date) && inRange(g.slot_date))) {
      if (g.dj_id || g.notes?.trim()) {
        if (!g.off_schedule) plan.keepOff.push(g.id);
      } else plan.remove.push(g.id);
      continue;
    }
    if (hhmm(g.start_time) !== next.start_time || hhmm(g.end_time) !== next.end_time) {
      const note = g.coverage === "confirmed" ? `Hours changed from ${fmtHours(hhmm(g.start_time), hhmm(g.end_time))} to ${fmtHours(next.start_time, next.end_time)}.` : null;
      plan.retime.push({ id: g.id, start_time: next.start_time, end_time: next.end_time, change_note: note });
    }
  }
  return plan;
}

/**
 * Assigning a DJ to "this and future gigs": every scheduled gig from `from`
 * on that isn't edited "this gig only" and isn't confirmed by another DJ.
 */
export function gigsForFutureDj(gigs: Gig[], djId: string | null, from: string) {
  return gigs.filter((g) => g.gig_date >= from && g.outcome === "scheduled" && !g.detached && g.dj_id !== djId && !(g.coverage === "confirmed" && g.dj_id));
}

export type StatusTone = "neutral" | "approved" | "pending" | "declined" | "info";
/** The status chip for a gig row. */
export function gigStatus(g: Pick<Gig, "coverage" | "outcome" | "gig_date">, hasRecap: boolean, today: string): { label: string; tone: StatusTone } {
  if (g.outcome === "canceled") return { label: "Canceled", tone: "declined" };
  if (g.outcome === "played") return hasRecap ? { label: "Played", tone: "approved" } : { label: "Recap due", tone: "pending" };
  if (g.gig_date < today) return { label: g.coverage === "confirmed" ? "Mark played" : "Past · not covered", tone: g.coverage === "confirmed" ? "pending" : "declined" };
  if (g.coverage === "confirmed") return { label: "Confirmed", tone: "approved" };
  if (g.coverage === "awaiting") return { label: "Awaiting confirmation", tone: "pending" };
  return { label: "Unassigned", tone: "neutral" };
}

/** The next gig: earliest from today that isn't canceled. */
export function nextGig<T extends Pick<Gig, "gig_date" | "outcome" | "start_time">>(gigs: T[], today: string): T | null {
  return [...gigs].filter((g) => g.gig_date >= today && g.outcome !== "canceled").sort((a, b) => a.gig_date.localeCompare(b.gig_date) || a.start_time.localeCompare(b.start_time))[0] ?? null;
}

/** "Sun, Nov 22". */
export function fmtGigDate(d: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) {
  return toDate(d).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

/** Has the gig started (so a recap can be written)? Dates in the residency's zone. */
export const gigStarted = (g: Pick<Gig, "gig_date">, today: string) => g.gig_date <= today;

export type MonthSummary = {
  scheduled: number;
  played: number;
  canceled: number;
  coverage: Record<Coverage, number>;
  venueDueCents: number;
  venuePaidCents: number;
  venueOutstandingCents: number;
  payoutDueCents: number;
  payoutPaidCents: number;
  payoutOutstandingCents: number;
};

/**
 * One month of a residency: gigs by outcome, coverage of the ones not
 * canceled, and money owed per played gig (venue fee in, DJ payout out).
 */
export function monthSummary(
  gigs: { id: string; outcome: Outcome; coverage: Coverage; venue_fee_cents: number | null; dj_payout_cents: number | null; dj_id: string | null }[],
  venuePaid: Record<string, number>,
  payouts: Record<string, { amount_cents: number; status: string }>
): MonthSummary {
  const s: MonthSummary = { scheduled: 0, played: 0, canceled: 0, coverage: { unassigned: 0, awaiting: 0, confirmed: 0 }, venueDueCents: 0, venuePaidCents: 0, venueOutstandingCents: 0, payoutDueCents: 0, payoutPaidCents: 0, payoutOutstandingCents: 0 };
  for (const g of gigs) {
    s[g.outcome]++;
    if (g.outcome !== "canceled") s.coverage[g.coverage]++;
    const paidIn = venuePaid[g.id] ?? 0;
    s.venuePaidCents += paidIn;
    if (g.outcome === "played") {
      const fee = g.venue_fee_cents ?? 0;
      s.venueDueCents += fee;
      s.venueOutstandingCents += Math.max(fee - paidIn, 0);
      const p = payouts[g.id];
      const owed = p?.amount_cents ?? (g.dj_id ? (g.dj_payout_cents ?? 0) : 0);
      s.payoutDueCents += owed;
      if (p?.status === "paid") s.payoutPaidCents += p.amount_cents;
      else s.payoutOutstandingCents += owed;
    }
  }
  return s;
}

/** The three recap prompts the DJ answers after a gig. */
export const RECAP_PROMPTS = [
  { key: "picked_up", label: "When did the room pick up?", placeholder: "Around 2 PM once the game ended", max: 500 },
  { key: "worked", label: "What worked?", placeholder: "Throwbacks, 2000s hip-hop, a few line dances", max: 1000 },
  { key: "next_dj", label: "What should the next DJ know?", placeholder: "Manager likes the volume down during food service", max: 1000 }
] as const;

export const BRIEF_FIELDS = [
  { key: "load_in", label: "Load-in" },
  { key: "house_gear", label: "House gear" },
  { key: "music", label: "Music direction" },
  { key: "expectations", label: "Venue expectations" }
] as const;
export type BriefKey = (typeof BRIEF_FIELDS)[number]["key"];
export type Brief = Partial<Record<BriefKey, string>>;
