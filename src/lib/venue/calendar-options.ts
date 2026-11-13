/**
 * How venues and DJs are written on the shared DCDJ Google Calendar.
 * These fill the dropdowns in Admin → Venue Portals; add to the lists when a
 * new venue or DJ starts appearing on the calendar.
 */
export const VENUE_CALENDAR_OPTIONS = ["Casey Key", "North 48", "Brass Boar's Den"] as const;
export const DJ_CALENDAR_OPTIONS = ["Que", "GMO", "Makara", "Bubblz", "Omerta", "Penny", "Peace", "Hydef", "J Prime", "Rushie", "Scary Terry"] as const;

export type CalendarDjName = { id: string; calendar_name: string; display_name: string };

/** Lowercase, accents and curly apostrophes removed ("Omertà" = "omerta", "Boar’s" = "boar's"). */
export function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’‘`ʼ]/g, "'").toLowerCase();
}

/**
 * The real DJ name for a calendar night: the first DJ whose calendar name
 * appears as a whole word in the DJ part of the title (e.g. "J Prime") or in
 * the name the members area matched. Null when none of your DJs match.
 */
export function resolveDjName(map: CalendarDjName[], ...texts: (string | null | undefined)[]): CalendarDjName | null {
  const hay = texts.filter(Boolean).map((t) => ` ${fold(String(t)).replace(/[^a-z0-9']+/g, " ")} `);
  if (!hay.length) return null;
  for (const m of [...map].sort((a, b) => b.calendar_name.length - a.calendar_name.length)) {
    const k = fold(m.calendar_name).replace(/[^a-z0-9']+/g, " ").trim();
    if (k && hay.some((h) => h.includes(` ${k} `))) return m;
  }
  return null;
}

/** "Casey Keys" -> ["Casey Keys", "Casey Key"]; "Casey Key Pub" -> [..., "Casey Key"]. */
export function venueNameVariants(name: string): string[] {
  const base = name.replace(/[’‘`ʼ]/g, "'").replace(/\s+/g, " ").trim();
  if (base.length < 3) return [];
  const out = new Set<string>([base]);
  const noType = base.replace(/\s+(pub|bar|tavern|lounge|grill|saloon|club|bar & grill|bar and grill)$/i, "").trim();
  for (const v of [base, noType]) {
    out.add(v);
    if (/[a-z]s$/i.test(v) && !/'s$/i.test(v)) out.add(v.slice(0, -1));
  }
  return [...out].filter((v) => v.length >= 3);
}

/** True when a saved "calendar name" is really a DJ (from your DJ list or the standard DJ names). */
export function isDjName(name: string, djs: { calendar_name: string; display_name: string }[]): boolean {
  if (/^\s*dj\b/i.test(name)) return true;
  const k = fold(name).replace(/^dj\s+/, "").replace(/[^a-z0-9']+/g, " ").trim();
  if (!k) return false;
  const pool = [...DJ_CALENDAR_OPTIONS, ...djs.flatMap((d) => [d.calendar_name, d.display_name])];
  return pool.some((p) => fold(p).replace(/^dj\s+/, "").replace(/[^a-z0-9']+/g, " ").trim() === k);
}

/** What the venue portal searches the calendar for: the venue's own name, plus saved calendar names that aren't DJs. */
export function venueSearchNames(venueName: string, saved: string[], djs: { calendar_name: string; display_name: string }[]): string[] {
  const keep = saved.map((s) => s.trim()).filter((s) => s.length >= 2 && !isDjName(s, djs));
  const all = [...venueNameVariants(venueName), ...keep];
  const seen = new Set<string>();
  return all.filter((n) => (seen.has(fold(n)) ? false : (seen.add(fold(n)), true))).slice(0, 20);
}
