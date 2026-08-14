import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { deleteExpense } from "@/lib/data/expenses";
import { requirePermission } from "@/lib/require-permission";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("finance.manage");
  if (denied) return denied;

  const { id } = await params;
  try {
    await deleteExpense(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
