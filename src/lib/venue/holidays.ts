// Big bar nights venues plan entertainment for. Dates are computed, so
// the list rolls forward every year without anyone editing it.

export interface HolidayNight {
  key: string;
  name: string;
  date: string; // YYYY-MM-DD (the night entertainment is booked)
  note?: string;
}

const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/** nth weekday (0=Sun) of a month; n = -1 for the last one. */
function nthWeekday(y: number, m: number, weekday: number, n: number) {
  if (n > 0) {
    const first = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    return 1 + ((weekday - first + 7) % 7) + (n - 1) * 7;
  }
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const lastDow = new Date(Date.UTC(y, m - 1, lastDay)).getUTCDay();
  return lastDay - ((lastDow - weekday + 7) % 7);
}

function shift(y: number, m: number, d: number, days: number) {
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return iso(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

export function holidaysForYear(y: number): HolidayNight[] {
  const memorial = nthWeekday(y, 5, 1, -1);
  const labor = nthWeekday(y, 9, 1, 1);
  const thanksgiving = nthWeekday(y, 11, 4, 4);
  return [
    { key: "st-patricks", name: "St. Patrick's Day", date: iso(y, 3, 17) },
    { key: "memorial-weekend", name: "Memorial Day weekend", date: shift(y, 5, memorial, -2), note: "Saturday night" },
    { key: "july-4", name: "Fourth of July", date: iso(y, 7, 4) },
    { key: "labor-weekend", name: "Labor Day weekend", date: shift(y, 9, labor, -2), note: "Saturday night" },
    { key: "halloween", name: "Halloween", date: iso(y, 10, 31) },
    { key: "thanksgiving-eve", name: "Thanksgiving Eve", date: shift(y, 11, thanksgiving, -1), note: "Blackout Wednesday" },
    { key: "nye", name: "New Year's Eve", date: iso(y, 12, 31) }
  ];
}

/** Holidays from `fromIso` forward, across this year and next. */
export function upcomingHolidays(fromIso: string, limit = 7): HolidayNight[] {
  const y = Number(fromIso.slice(0, 4));
  return [...holidaysForYear(y), ...holidaysForYear(y + 1)].filter((h) => h.date >= fromIso).slice(0, limit);
}

export function holidaysInMonth(month: string): HolidayNight[] {
  const y = Number(month.slice(0, 4));
  return holidaysForYear(y).filter((h) => h.date.startsWith(month));
}
