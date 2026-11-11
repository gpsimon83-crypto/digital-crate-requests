import { NextRequest, NextResponse } from "next/server";
import { getEvent } from "@/lib/data/events";
import { requireEventAccess } from "@/lib/require-event-access";
import { logActivity } from "@/lib/activity";
import { runAutomations } from "@/lib/automations-engine";
import { confirmBooking, supabaseConfirmDeps } from "@/lib/security/booking-confirmation";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = (await req.json().catch(() => ({}))) as { allowOverlap?: unknown };
  try {
    const r = await confirmBooking({ eventId: id, isStaff: access.isAdmin, allowOverlap: body.allowOverlap === true }, supabaseConfirmDeps());
    if (r.status !== 200) return NextResponse.json(r.body, { status: r.status });
    const event = await getEvent(id);
    if (!r.body.alreadyConfirmed) {
      await logActivity({
        actorUserId: access.user.id,
        action: "event.confirmed",
        entityType: "event",
        entityId: id,
        eventId: id,
        metadata: body.allowOverlap === true && access.isAdmin ? { overlap_override: true } : {}
      });
      await runAutomations("event_confirmed", id, req.nextUrl.origin);
    }
    return NextResponse.json({ event });
  } catch (err) {
    console.error("confirm failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Couldn't confirm this booking right now." }, { status: 503 });
  }
}
