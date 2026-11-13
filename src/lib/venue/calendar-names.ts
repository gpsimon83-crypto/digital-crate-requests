/**
 * Matching between venue records and the names found on the shared DCDJ
 * calendar. Comparison ignores case, apostrophes, punctuation and a trailing
 * plural "s", so "Casey Keys", "Casey Key" and "casey key's" are the same.
 */

export function nameKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/['’‘`]/g, "")
    .replace(/[^\p{L}\p{N} ]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/(?<=\w)s\b/g, "");
}

/** True when a venue already catches this calendar name (one of its calendar names appears in, or contains, a spelling). */
export function isLinked(calendarNames: string[], match: string[]): boolean {
  const mine = calendarNames.map((n) => n.toLowerCase().trim()).filter(Boolean);
  return match.some((m) => {
    const x = m.toLowerCase();
    return mine.some((n) => x.includes(n) || n.includes(x));
  });
}

/** True when a venue's own name looks like the calendar name ("Casey Keys" ~ "Casey Key", "North 48" ~ "North 48 Cedarburg"). */
export function looksLike(venueName: string, calendarName: string): boolean {
  const a = nameKey(venueName);
  const b = nameKey(calendarName);
  if (a.length < 3 || b.length < 3) return false;
  return a === b || a.includes(b) || b.includes(a);
}

/** Calendar spellings to add to a venue, skipping ones it already has. */
export function namesToAdd(current: string[], match: string[]): string[] {
  const have = new Set(current.map((n) => n.toLowerCase().trim()));
  return match.filter((m) => !have.has(m.toLowerCase().trim()));
}
