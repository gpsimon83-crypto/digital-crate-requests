import { NextRequest, NextResponse } from "next/server";
import { getAvailability, getSlotMinutes, getConsultationEventsOnDate, getBusyBlocksOnDate } from "@/lib/data/scheduler";
import { zonedTimeToUtc, utcToZonedDateStr } from "@/lib/scheduler-time";
import { productionDeps, submitPublicRequest } from "@/lib/security/inquiry-service";
import { readJson, requestContext } from "@/lib/security/request-context";

/** Is a consultation slot still bookable? Business hours, not past, no overlap with calls, holds or busy time. */
async function slotAvailable(date: string, time: string) {
  const [availability, slotMinutes, existing, busyBlocks] = await Promise.all([
    getAvailability(),
    getSlotMinutes(),
    getConsultationEventsOnDate(date),
    getBusyBlocksOnDate(date)
  ]);
  const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
  const day = availability.find((a) => a.day_of_week === dayOfWeek);
  if (!day || !day.enabled) return { ok: false as const, status: 409, error: "That day isn't available for booking." };
  if (time < day.start_time.slice(0, 5) || time >= day.end_time.slice(0, 5)) {
    return { ok: false as const, status: 409, error: "That time isn't available — please pick one of the listed times." };
  }

  const start = zonedTimeToUtc(date, time);
  const end = new Date(start.getTime() + slotMinutes * 60000);
  if (start.getTime() < Date.now()) return { ok: false as const, status: 409, error: "That time has already passed." };

  const overlaps = [...existing, ...busyBlocks.map((b) => ({ ...b, status: "busy" }))]
    .filter((e) => utcToZonedDateStr(new Date(e.starts_at)) === date)
    .some((e) => start.getTime() < new Date(e.ends_at ?? e.starts_at).getTime() && end.getTime() > new Date(e.starts_at).getTime());
  if (overlaps) return { ok: false as const, status: 409, error: "That time was just booked — please pick another slot." };
  return { ok: true as const, start, end };
}

/**
 * Public consultation-call request. The slot is held (so nobody else can
 * take it) while the person confirms their email; the call is only added
 * to the calendar, and staff alerted, after that confirmation.
 */
export async function POST(req: NextRequest) {
  const ctx = requestContext(req.headers);
  const body = await readJson(req);
  try {
    const result = await submitPublicRequest("consultation", body, { ...ctx, partner: false }, await productionDeps({ slotAvailable }));
    return NextResponse.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("consultation submit failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "We couldn't book that right now. Please try again in a few minutes, or email us." }, { status: 503 });
  }
}
