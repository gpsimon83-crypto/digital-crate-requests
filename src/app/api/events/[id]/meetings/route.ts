import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { listMeetings, createMeeting } from "@/lib/data/event-meetings";
import { parseMeetingBody, emailClientAboutMeeting } from "@/lib/meeting-helpers";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const meetings = await listMeetings(id);
    return NextResponse.json({ meetings });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  const parsed = parseMeetingBody(await req.json());
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const meeting = await createMeeting(id, { ...parsed.input, createdBy: access.user.id });
    await logActivity({ actorUserId: access.user.id, action: "meeting.scheduled", entityType: "event", entityId: id, eventId: id });
    await emailClientAboutMeeting({ kind: "scheduled", client: access.event.clients, eventTitle: access.event.title, meeting, eventId: id });
    return NextResponse.json({ meeting });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
