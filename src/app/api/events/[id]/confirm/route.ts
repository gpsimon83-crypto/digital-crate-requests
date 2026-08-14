import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { confirmEvent } from "@/lib/data/events";
import { requireAuth } from "@/lib/require-auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { runAutomations } from "@/lib/automations-engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  try {
    const event = await confirmEvent(id);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await logActivity({ actorUserId: user?.id, action: "event.confirmed", entityType: "event", entityId: id, eventId: id });
    await runAutomations("event_confirmed", id, req.nextUrl.origin);
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
