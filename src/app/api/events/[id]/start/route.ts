import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { startEvent } from "@/lib/data/events";
import { requireAuth } from "@/lib/require-auth";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;
  try {
    const event = await startEvent(id);
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
