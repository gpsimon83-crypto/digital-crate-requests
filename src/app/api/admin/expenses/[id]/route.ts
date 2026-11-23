import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { deleteExpense, updateExpense } from "@/lib/data/expenses";
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

/** Edit an expense: description, amount, category, date. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("finance.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as { description?: unknown; amountCents?: unknown; category?: unknown; incurredOn?: unknown };
  const updates: Parameters<typeof updateExpense>[1] = {};
  if (body.description !== undefined) {
    const d = typeof body.description === "string" ? body.description.trim() : "";
    if (!d || d.length > 300) return NextResponse.json({ error: "An expense needs a description" }, { status: 400 });
    updates.description = d;
  }
  if (body.amountCents !== undefined) {
    const n = Number(body.amountCents);
    if (!Number.isInteger(n) || n <= 0 || n > 1_000_000_000) return NextResponse.json({ error: "Amount must be more than $0" }, { status: 400 });
    updates.amount_cents = n;
  }
  if (body.category !== undefined) updates.category = typeof body.category === "string" && body.category.trim() ? body.category.trim().slice(0, 60) : null;
  if (body.incurredOn !== undefined) {
    if (typeof body.incurredOn !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(body.incurredOn)) return NextResponse.json({ error: "Date must be a date" }, { status: 400 });
    updates.incurred_on = body.incurredOn;
  }
  if (Object.keys(updates).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  try {
    const expense = await updateExpense(id, updates);
    return NextResponse.json({ expense });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
