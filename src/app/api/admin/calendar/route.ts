import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getConnection, getConnectionWithSecrets, deleteConnection, setScheduleCalendar } from "@/lib/data/calendar-connection";
import { revokeToken } from "@/lib/google-calendar";
import { errorMessage } from "@/lib/error-message";
import { listConnectedCalendars, runCalendarSync } from "@/lib/calendar-sync";

// A full pull can be a year of entries.
export const maxDuration = 60;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const connection = await getConnection();
    return NextResponse.json({ connection });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Sync now. `{ full: true }` pulls the whole calendar again (past year onward) instead of only recent changes. */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { full?: unknown };
  try {
    const result = await runCalendarSync({ full: body.full === true });
    if (!result.connected) return NextResponse.json({ error: "Google Calendar isn't connected." }, { status: 409 });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/**
 * Choose the DJ schedule calendar: `{ scheduleCalendarId }` (one the
 * connected account can see) or null to stop reading one. Pulls it right away.
 */
export async function PATCH(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { scheduleCalendarId?: unknown };
  const id = typeof body.scheduleCalendarId === "string" ? body.scheduleCalendarId.trim() : null;
  try {
    if (!id) {
      await setScheduleCalendar(null, null);
      return NextResponse.json({ ok: true, pulled: 0 });
    }
    const cals = await listConnectedCalendars();
    if (!cals) return NextResponse.json({ error: "Google Calendar isn't connected." }, { status: 409 });
    const cal = cals.find((c) => c.id === id);
    if (!cal) return NextResponse.json({ error: "That calendar isn't on the connected Google account." }, { status: 400 });
    await setScheduleCalendar(cal.id, cal.name);
    const result = await runCalendarSync();
    return NextResponse.json({ ok: true, pulled: result.pulled });
  } catch (err) {
    const msg = errorMessage(err);
    if (/schedule_calendar|dj_schedule_entries/.test(msg)) return NextResponse.json({ error: "Run migration 0065 in Supabase first." }, { status: 503 });
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}

export async function DELETE() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const conn = await getConnectionWithSecrets();
    if (conn) await revokeToken(conn.refreshToken);
    await deleteConnection();
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
