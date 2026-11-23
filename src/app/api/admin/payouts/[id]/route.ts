import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { updatePayout, deletePayout } from "@/lib/data/payouts";
import { requirePermission } from "@/lib/require-permission";
import { logActivity } from "@/lib/activity";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("finance.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const { amountCents, notes, status } = body as { amountCents?: number; notes?: string | null; status?: "pending" | "paid" };

  try {
    if (amountCents !== undefined && (!Number.isInteger(amountCents) || amountCents <= 0)) return NextResponse.json({ error: "Amount must be more than $0" }, { status: 400 });
    // An edit that clears the note sends null; only leave the note alone when it isn't sent.
    const payout = await updatePayout(id, { amountCents, notes: "notes" in body ? (typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 500) : null) : undefined, status });
    if (status === "paid") {
      await logActivity({ action: "payout.paid", entityType: "payout", entityId: id, eventId: payout.event_id, metadata: { amountCents: payout.amount_cents, djId: payout.dj_id } });
    }
    return NextResponse.json({ payout });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("finance.manage");
  if (denied) return denied;

  const { id } = await params;
  try {
    await deletePayout(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
