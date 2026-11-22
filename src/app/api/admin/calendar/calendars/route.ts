import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { listConnectedCalendars } from "@/lib/calendar-sync";
import { errorMessage } from "@/lib/error-message";

/** The calendars on the connected Google account (names and ids only), for picking the DJ schedule calendar. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const calendars = await listConnectedCalendars();
    if (!calendars) return NextResponse.json({ error: "Google Calendar isn't connected." }, { status: 409 });
    return NextResponse.json({ calendars });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
