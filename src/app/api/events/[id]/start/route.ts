import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { startEvent } from "@/lib/data/events";
import { requireEventAccess } from "@/lib/require-event-access";
import { createClient } from "@/lib/supabase/server";
import { logActivity } from "@/lib/activity";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

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
