import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAvailability, getSlotMinutes, getConsultationEventsOnDate, getBusyBlocksOnDate } from "@/lib/data/scheduler";
import { zonedTimeToUtc, utcToZonedDateStr } from "@/lib/scheduler-time";
import { logActivity } from "@/lib/activity";
import { runAutomations } from "@/lib/automations-engine";

function generateEventCode() {
  return `CONSULT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

/**
 * Public, unauthenticated — the whole point is a stranger who's never
 * been in the system before can book a call. A booking is just an
 * `events` row (event_type='consultation', status='inquiry'), the same
 * table and lifecycle stage the homepage's inquiry form already writes
 * to, so it shows up in Lead Capture and the admin Calendar for free.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { name, email, phone, date, time, message } = body as {
    name?: string;
    email?: string;
    phone?: string;
    date?: string;
    time?: string;
    message?: string;
  };

  if (!name || !email || !date || !time) {
    return NextResponse.json({ error: "name, email, date, and time are required" }, { status: 400 });
  }

  try {
    const [availability, slotMinutes, existing, busyBlocks] = await Promise.all([
      getAvailability(),
      getSlotMinutes(),
      getConsultationEventsOnDate(date),
      getBusyBlocksOnDate(date)
    ]);

    const dayOfWeek = new Date(`${date}T00:00:00Z`).getUTCDay();
    const day = availability.find((a) => a.day_of_week === dayOfWeek);
    if (!day || !day.enabled) {
      return NextResponse.json({ error: "That day isn't available for booking" }, { status: 409 });
    }

    const slotStart = zonedTimeToUtc(date, time);
    const slotEnd = new Date(slotStart.getTime() + slotMinutes * 60000);

    if (slotStart.getTime() < Date.now()) {
      return NextResponse.json({ error: "That time has already passed" }, { status: 409 });
    }

    const overlapsBooked = existing
      .filter((e) => utcToZonedDateStr(new Date(e.starts_at)) === date)
      .some((e) => {
        const bStart = new Date(e.starts_at).getTime();
        const bEnd = new Date(e.ends_at ?? e.starts_at).getTime();
        return slotStart.getTime() < bEnd && slotEnd.getTime() > bStart;
      });
    const overlapsBusy = busyBlocks
      .filter((b) => utcToZonedDateStr(new Date(b.starts_at)) === date)
      .some((b) => slotStart.getTime() < new Date(b.ends_at).getTime() && slotEnd.getTime() > new Date(b.starts_at).getTime());
    if (overlapsBooked || overlapsBusy) {
      return NextResponse.json({ error: "That time was just booked — pick another slot" }, { status: 409 });
    }

    const db = createAdminClient();

    const { data: existingClient } = await db
      .from("clients")
      .select("id")
      .eq("email", email)
      .is("deleted_at", null)
      .maybeSingle();

    let clientId = existingClient?.id as string | undefined;

    if (!clientId) {
      const [firstName, ...rest] = name.trim().split(" ");
      const { data: newClient, error: clientError } = await db
        .from("clients")
        .insert({
          type: "individual",
          first_name: firstName || name,
          last_name: rest.join(" ") || null,
          email,
          phone: phone || null,
          referral_source: "scheduler"
        })
        .select("id")
        .single();
      if (clientError) throw clientError;
      clientId = newClient.id;
    }

    const { data: event, error: eventError } = await db
      .from("events")
      .insert({
        event_code: generateEventCode(),
        title: `Consultation call — ${name}`,
        client_id: clientId,
        starts_at: slotStart.toISOString(),
        ends_at: slotEnd.toISOString(),
        status: "inquiry",
        event_status: "tentative",
        event_type: "consultation",
        special_requests: message || null
      })
      .select()
      .single();
    if (eventError) throw eventError;

    await logActivity({ actorLabel: "Scheduler", action: "lead.created", entityType: "event", entityId: event.id, eventId: event.id });
    await runAutomations("lead_created", event.id, req.nextUrl.origin);

    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
