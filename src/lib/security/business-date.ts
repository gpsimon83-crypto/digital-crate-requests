// Calendar-date rules for public event dates. No server-only imports, so the
// booking form uses the same functions the API enforces.
//
// Event dates are calendar dates ("2026-12-31"), never instants, so they are
// compared as YYYY-MM-DD strings against "today" in the business timezone.
// Converting a date-only value to a Date/UTC instant is what causes the
// classic off-by-one around midnight, so that never happens here.

export const BUSINESS_TIMEZONE = "America/Chicago";

export const PAST_DATE_MESSAGE = "Please select today or a future date. Past event dates cannot be submitted.";

/** How far ahead a public request may be (keeps typos like 2062 out). */
export const MAX_YEARS_AHEAD = 3;

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Today's date in the business timezone, as YYYY-MM-DD. */
export function businessToday(now: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** A real calendar date in strict YYYY-MM-DD form (rejects 2026-02-30). */
export function isValidDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const m = DATE_RE.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (y < 1900 || mo < 1 || mo > 12 || d < 1) return false;
  const dim = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  return d <= dim;
}

/** True when the date is before today in America/Chicago. Today itself is allowed. */
export function isPastEventDate(dateStr: string, now: Date = new Date()): boolean {
  return dateStr < businessToday(now);
}

export function latestAllowedDate(now: Date = new Date()): string {
  const [y, m, d] = businessToday(now).split("-");
  return `${Number(y) + MAX_YEARS_AHEAD}-${m}-${d}`;
}

/** Shared rule for public event-date fields. Returns an error message, or null when OK. */
export function checkPublicEventDate(value: unknown, now: Date = new Date()): string | null {
  if (!isValidDateString(value)) return "Please choose a valid event date.";
  if (isPastEventDate(value, now)) return PAST_DATE_MESSAGE;
  if (value > latestAllowedDate(now)) return `Please choose a date within the next ${MAX_YEARS_AHEAD} years.`;
  return null;
}
