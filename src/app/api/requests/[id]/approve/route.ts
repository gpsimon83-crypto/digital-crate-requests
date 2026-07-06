import { NextRequest, NextResponse } from "next/server";
import { approveRequest } from "@/lib/data/requests";
import { requireAuth } from "@/lib/require-auth";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await params;
  const updated = await approveRequest(id);
  return NextResponse.json({ request: updated });
}
