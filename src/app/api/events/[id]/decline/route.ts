import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { declineEvent } from "@/lib/data/events";
import { requireEventAccess } from "@/lib/require-event-access";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";
import { runAutomations } from "@/lib/automations-engine";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const event = await declineEvent(id);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await logActivity({ actorUserId: user?.id, action: "event.declined", entityType: "event", entityId: id, eventId: id });
    await runAutomations("event_declined", id, req.nextUrl.origin);
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
