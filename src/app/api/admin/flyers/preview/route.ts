import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerAdmin, flyerError, uuidOk } from "@/lib/flyers/server";
import { flyerEvents, loadFlyerContext } from "@/lib/flyers/data";
import { findCalendarNight, isCalendarKey } from "@/lib/flyers/calendar-nights";

/**
 * Template editor preview (staff). Without ?event / ?venue: the upcoming
 * bookings and venue nights to preview with. With them: the real values
 * a flyer for that event or venue would get, with the chosen DJs in slots
 * 1 and 2. Read only.
 */
export async function GET(req: NextRequest) {
  const admin = await flyerAdmin();
  if (admin instanceof NextResponse) return admin;
  const p = req.nextUrl.searchParams;
  const event = p.get("event");
  const venue = p.get("venue");
  const slots = [p.get("dj1"), p.get("dj2"), p.get("dj3")].map((x) => (uuidOk(x) ? x : null));
  try {
    const db = createAdminClient();
    if (!event && !venue) return NextResponse.json({ events: await flyerEvents(db, { djId: null, staff: true }) });
    const night = isCalendarKey(event) ? await findCalendarNight(db, event) : null;
    const ctx = await loadFlyerContext(db, {
      eventId: event && uuidOk(event) ? event : null,
      venueId: uuidOk(venue) ? venue : null,
      calendarNight: night,
      djSlots: slots.some(Boolean) ? slots : null
    });
    return NextResponse.json({ values: ctx.values, slots: ctx.slots, venueId: ctx.venue?.id ?? null, djs: ctx.djs, drinkSpecials: ctx.drinkSpecials });
  } catch (err) {
    return flyerError(err);
  }
}
