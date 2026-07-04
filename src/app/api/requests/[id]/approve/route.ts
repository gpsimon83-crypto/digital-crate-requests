import { NextRequest, NextResponse } from "next/server";
import { approveRequest } from "@/lib/data/requests";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const updated = await approveRequest(id);
  return NextResponse.json({ request: updated });
}
