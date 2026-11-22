import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getConnection, getConnectionWithSecrets, deleteConnection } from "@/lib/data/calendar-connection";
import { revokeToken } from "@/lib/google-calendar";
import { errorMessage } from "@/lib/error-message";
import { runCalendarSync } from "@/lib/calendar-sync";

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
