import { NextRequest, NextResponse } from "next/server";
import { requireStaffUser } from "@/lib/comm/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { syncPlaybook } from "@/lib/data/playbook";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

/**
 * Staff: void a payment that was recorded by mistake. Only hand-recorded
 * payments; card payments are refunded in Stripe. The row stays in the
 * history (marked voided) and stops counting toward the balance.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const { id, paymentId } = await params;
  const body = (await req.json().catch(() => ({}))) as { action?: string; reason?: string };
  if (body.action !== "void") return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  const reason = String(body.reason ?? "").trim().slice(0, 300);
  if (!reason) return NextResponse.json({ error: "Say why it's being voided." }, { status: 400 });

  const db = createAdminClient();
  const { data: row } = await db.from("payments").select("*").eq("id", paymentId).eq("event_id", id).maybeSingle();
  const pay = row as { id: string; status: string; stripe_payment_intent_id: string | null; amount_cents: number; kind: string } | null;
  if (!pay) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (pay.stripe_payment_intent_id) return NextResponse.json({ error: "Card payments are refunded in Stripe, not voided here." }, { status: 400 });
  if (pay.status === "voided") return NextResponse.json({ error: "Already voided." }, { status: 409 });

  try {
    const { data, error } = await db
      .from("payments")
      .update({ status: "voided", voided_at: new Date().toISOString(), voided_by: staff.userId, void_reason: reason })
      .eq("id", paymentId)
      .eq("event_id", id)
      .eq("status", pay.status)
      .select()
      .maybeSingle();
    if (error && ["42703", "PGRST204"].includes((error as { code?: string }).code ?? "")) return NextResponse.json({ error: "Run migration 0060_manual_payments.sql first." }, { status: 503 });
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Already changed. Refresh and try again." }, { status: 409 });
    await logActivity({ actorUserId: staff.userId, action: "payment.voided", entityType: "event", entityId: id, eventId: id, metadata: { paymentId, kind: pay.kind, amountCents: pay.amount_cents, reason } });
    await syncPlaybook(id).catch(() => {});
    return NextResponse.json({ payment: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/**
 * Staff: permanently remove a hand-recorded payment (entered on the wrong
 * project, a test entry...). Card payments stay, since Stripe has them; refund
 * those in Stripe. The removal is written to the activity log with the amount.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; paymentId: string }> }) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const { id, paymentId } = await params;
  const db = createAdminClient();
  const { data: row } = await db.from("payments").select("*").eq("id", paymentId).eq("event_id", id).maybeSingle();
  const pay = row as { id: string; status: string; stripe_payment_intent_id: string | null; amount_cents: number; kind: string; paid_at: string | null; method?: string | null; reference?: string | null } | null;
  if (!pay) return NextResponse.json({ error: "Payment not found" }, { status: 404 });
  if (pay.stripe_payment_intent_id) return NextResponse.json({ error: "Card payments can't be removed here. Refund them in Stripe." }, { status: 400 });
  try {
    const { error } = await db.from("payments").delete().eq("id", paymentId).eq("event_id", id);
    if (error) throw error;
    await logActivity({
      actorUserId: staff.userId,
      action: "payment.removed",
      entityType: "event",
      entityId: id,
      eventId: id,
      metadata: { paymentId, kind: pay.kind, amountCents: pay.amount_cents, status: pay.status, paidAt: pay.paid_at, method: pay.method ?? null, reference: pay.reference ?? null }
    });
    await syncPlaybook(id).catch(() => {});
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
