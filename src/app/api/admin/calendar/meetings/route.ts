import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { requireAdmin } from "@/lib/require-admin";
import { listUpcomingMeetingsForCalendar } from "@/lib/data/event-meetings";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const meetings = await listUpcomingMeetingsForCalendar();
    return NextResponse.json({ meetings });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
