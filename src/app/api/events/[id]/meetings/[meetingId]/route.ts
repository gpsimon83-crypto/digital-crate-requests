import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { updateMeeting, cancelMeeting } from "@/lib/data/event-meetings";
import { parseMeetingBody, emailClientAboutMeeting } from "@/lib/meeting-helpers";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; meetingId: string }> }) {
  const { id, meetingId } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = parseMeetingBody(await req.json());
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const meeting = await updateMeeting(id, meetingId, parsed.input);
    await logActivity({ actorUserId: access.user.id, action: "meeting.rescheduled", entityType: "event", entityId: id, eventId: id });
    await emailClientAboutMeeting({ kind: "rescheduled", client: access.event.clients, eventTitle: access.event.title, meeting, eventId: id });
    return NextResponse.json({ meeting });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; meetingId: string }> }) {
  const { id, meetingId } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const meeting = await cancelMeeting(id, meetingId);
    await logActivity({ actorUserId: access.user.id, action: "meeting.cancelled", entityType: "event", entityId: id, eventId: id });
    await emailClientAboutMeeting({ kind: "cancelled", client: access.event.clients, eventTitle: access.event.title, meeting, eventId: id });
    return NextResponse.json({ meeting });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
