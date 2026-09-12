export interface Countdown {
  days: number;
  label: string;
}

/**
 * Days between "now" and an event's start, computed in the event's own
 * timezone (a destination wedding shouldn't count down in the viewer's
 * browser zone). Returns null for events with no date — callers should
 * simply omit the countdown badge in that case, and for a past event.
 */
export function computeCountdown(startsAtISO: string | null, timezone: string | null): Countdown | null {
  if (!startsAtISO) return null;

  const tz = timezone || "America/Chicago";
  const startsAt = new Date(startsAtISO);
  if (Number.isNaN(startsAt.getTime())) return null;

  const dayKey = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
    const map: Record<string, string> = {};
    for (const p of parts) map[p.type] = p.value;
    return Date.UTC(Number(map.year), Number(map.month) - 1, Number(map.day));
  };

  const todayKey = dayKey(new Date());
  const eventKey = dayKey(startsAt);
  const days = Math.round((eventKey - todayKey) / 86_400_000);

  if (days < 0) return null;
  if (days === 0) return { days: 0, label: "Today's the day! 🎉" };
  if (days === 1) return { days: 1, label: "1 day to go" };
  return { days, label: `${days} days to go` };
}
