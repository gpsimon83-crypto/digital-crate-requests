export interface PrimaryEventCandidate {
  id: string;
  starts_at: string | null;
}

/**
 * The client portal centers on one "primary" event rather than making
 * clients pick which booking they mean every time they tap Files/Services/
 * Payments in the nav. Nearest upcoming event wins; once every event is in
 * the past, the most recent one stays selected so clients can still review
 * it.
 */
export function pickPrimaryEvent<T extends PrimaryEventCandidate>(events: T[]): T | null {
  if (events.length === 0) return null;
  const now = Date.now();
  const upcoming = events
    .filter((e) => e.starts_at && new Date(e.starts_at).getTime() >= now)
    .sort((a, b) => new Date(a.starts_at as string).getTime() - new Date(b.starts_at as string).getTime());
  if (upcoming.length > 0) return upcoming[0];
  return events[events.length - 1];
}
