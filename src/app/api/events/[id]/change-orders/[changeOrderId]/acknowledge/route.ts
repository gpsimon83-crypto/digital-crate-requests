import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { requireEventAccess } from "@/lib/require-event-access";
import { acknowledgeChangeOrderAsDj } from "@/lib/data/contract-change-orders";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string; changeOrderId: string }> }) {
  const { id, changeOrderId } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });
  if (!access.dj) return NextResponse.json({ error: "Only the assigned DJ can acknowledge this change" }, { status: 403 });

  try {
    const changeOrder = await acknowledgeChangeOrderAsDj(changeOrderId, id, access.dj.id);
    if (!changeOrder) return NextResponse.json({ error: "Change not found" }, { status: 404 });
    return NextResponse.json({ changeOrder });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
