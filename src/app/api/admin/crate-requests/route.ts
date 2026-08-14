import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { listCrateRequestSummary } from "@/lib/data/crate-requests";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const events = await listCrateRequestSummary();
    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
