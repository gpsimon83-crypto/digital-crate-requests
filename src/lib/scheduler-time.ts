/**
 * Nothing in this app stores an explicit business timezone (event
 * starts_at is just whatever the admin's own browser meant when they
 * typed it), so the scheduler needs its own fixed reference point rather
 * than inventing a bigger timezone system than anything asked for. Hardcoded
 * to US Central, matching the business's actual location.
 */
export const BUSINESS_TIMEZONE = "America/Chicago";

function partsOf(date: Date, timeZone: string) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = p.value;
  }
  if (parts.hour === "24") parts.hour = "00";
  return parts;
}

/** The UTC instant corresponding to a wall-clock date+time in the given zone (DST-aware). */
export function zonedTimeToUtc(dateStr: string, timeStr: string, timeZone: string = BUSINESS_TIMEZONE): Date {
  const guess = new Date(`${dateStr}T${timeStr}:00Z`);
  const parts = partsOf(guess, timeZone);
  const asIfUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return new Date(guess.getTime() + (guess.getTime() - asIfUtc));
}

export function utcToZonedDateStr(date: Date, timeZone: string = BUSINESS_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function hhmmToMinutes(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHHMM(mins: number) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function generateSlotStarts(startTime: string, endTime: string, slotMinutes: number): string[] {
  const slots: string[] = [];
  let cur = hhmmToMinutes(startTime);
  const end = hhmmToMinutes(endTime);
  while (cur + slotMinutes <= end) {
    slots.push(minutesToHHMM(cur));
    cur += slotMinutes;
  }
  return slots;
}
