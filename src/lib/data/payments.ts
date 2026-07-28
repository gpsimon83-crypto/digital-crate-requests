import { createAdminClient } from "@/lib/supabase/admin";

export interface PaymentRow {
  id: string;
  event_id: string;
  kind: string;
  amount_cents: number;
  status: string;
  stripe_payment_intent_id: string | null;
  paid_at: string | null;
  created_at: string;
}

export async function listEventPayments(eventId: string): Promise<PaymentRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("payments")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listSucceededPayments() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("payments")
    .select("id, event_id, kind, amount_cents, paid_at, events(title)")
    .eq("status", "succeeded")
    .order("paid_at", { ascending: false });
  if (error) throw error;
  return data;
}

/**
 * "Owed" is always computed from events.final_amount (or quoted_amount if
 * no final amount has been set yet) minus the sum of succeeded payments —
 * never stored redundantly, so it can't drift out of sync with the ledger.
 */
export function computeBalance(event: { quoted_amount: number | null; final_amount: number | null }, payments: PaymentRow[]) {
  const totalDueDollars = event.final_amount ?? event.quoted_amount ?? 0;
  const totalDueCents = Math.round(totalDueDollars * 100);
  const paidCents = payments.filter((p) => p.status === "succeeded").reduce((sum, p) => sum + p.amount_cents, 0);
  return {
    totalDueCents,
    paidCents,
    balanceCents: Math.max(totalDueCents - paidCents, 0)
  };
}

/**
 * Called only from the Stripe webhook on payment_intent.succeeded — never
 * from the client-facing create-intent route — so a row here always means
 * money actually landed, matching how tips/boosts already work.
 */
export async function recordSucceededPayment(eventId: string, kind: string, amountCents: number, paymentIntentId: string) {
  const db = createAdminClient();
  const { error } = await db.from("payments").insert({
    event_id: eventId,
    kind,
    amount_cents: amountCents,
    status: "succeeded",
    stripe_payment_intent_id: paymentIntentId,
    paid_at: new Date().toISOString()
  });
  if (error) throw error;
}
