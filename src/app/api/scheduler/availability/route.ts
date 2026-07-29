import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { getAvailability, getSlotMinutes, getConsultationEventsOnDate } from "@/lib/data/scheduler";
import { generateSlotStarts, zonedTimeToUtc, utcToZonedDateStr, BUSINESS_TIMEZONE } from "@/lib/scheduler-time";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "date=YYYY-MM-DD is required" }, { status: 400 });
  }

  try {
    const [availability, slotMinutes, existing] = await Promise.all([
      getAvailability(),
      getSlotMinutes(),
      getConsultationEventsOnDate(date)
    ]);

    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
    const day = availability.find((a) => a.day_of_week === dayOfWeek);

    if (!day || !day.enabled) {
      return NextResponse.json({ date, timezone: BUSINESS_TIMEZONE, slots: [] });
    }

    const starts = generateSlotStarts(day.start_time.slice(0, 5), day.end_time.slice(0, 5), slotMinutes);
    const now = Date.now();

    const bookedRanges = existing
      .filter((e) => utcToZonedDateStr(new Date(e.starts_at)) === date)
      .map((e) => ({ start: new Date(e.starts_at).getTime(), end: new Date(e.ends_at ?? e.starts_at).getTime() }));

    const slots = starts.map((time) => {
      const slotStart = zonedTimeToUtc(date, time);
      const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60000);
      const overlapsBooked = bookedRanges.some((b) => slotStart.getTime() < b.end && slotEnd.getTime() > b.start);
      const isPast = slotStart.getTime() < now;
      return { time, available: !overlapsBooked && !isPast };
    });

    return NextResponse.json({ date, timezone: BUSINESS_TIMEZONE, slotMinutes, slots });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
