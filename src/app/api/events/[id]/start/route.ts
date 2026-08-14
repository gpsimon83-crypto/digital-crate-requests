import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { startEvent } from "@/lib/data/events";
import { requireAuth } from "@/lib/require-auth";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  try {
    const event = await startEvent(id);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await logActivity({ actorUserId: user?.id, action: "event.started", entityType: "event", entityId: id, eventId: id });
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
