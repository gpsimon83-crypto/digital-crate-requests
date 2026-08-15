import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getConnection, getConnectionWithSecrets, deleteConnection } from "@/lib/data/calendar-connection";
import { revokeToken } from "@/lib/google-calendar";
import { errorMessage } from "@/lib/error-message";

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
