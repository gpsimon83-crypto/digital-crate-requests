import { NextRequest, NextResponse } from "next/server";
import { upvoteRequest } from "@/lib/data/requests";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { customerId } = await req.json().catch(() => ({}));
  const updated = await upvoteRequest(id, customerId);
  return NextResponse.json({ request: updated });
}
