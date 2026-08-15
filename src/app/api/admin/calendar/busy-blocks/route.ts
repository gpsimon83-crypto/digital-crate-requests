import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { listUpcomingBusyBlocks } from "@/lib/data/external-busy-blocks";
import { errorMessage } from "@/lib/error-message";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const blocks = await listUpcomingBusyBlocks();
    return NextResponse.json({ blocks });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
