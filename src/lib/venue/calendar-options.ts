/**
 * How venues and DJs are written on the shared DCDJ Google Calendar.
 * These fill the dropdowns in Admin → Venue Portals; add to the lists when a
 * new venue or DJ starts appearing on the calendar.
 */
export const VENUE_CALENDAR_OPTIONS = ["Casey Key", "North 48", "Brass Boar's Den"] as const;
export const DJ_CALENDAR_OPTIONS = ["Que", "GMO", "Makara", "Bubblz", "Omerta", "Penny"] as const;

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
