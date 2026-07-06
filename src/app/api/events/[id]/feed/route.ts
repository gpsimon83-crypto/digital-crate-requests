import { NextRequest, NextResponse } from "next/server";
import { listFeedEvents } from "@/lib/data/requests";
import { requireAuth } from "@/lib/require-auth";
import { errorMessage } from "@/lib/error-message";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  try {
    const feed = await listFeedEvents(id);
    return NextResponse.json({ feed });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
