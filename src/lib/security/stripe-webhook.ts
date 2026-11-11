import type Stripe from "stripe";
import type { WebhookLedger } from "@/lib/security/webhook-idempotency";

export interface StripeHandlerDeps {
  ledger: WebhookLedger;
  expectLivemode: boolean | null;
  eventExists: (eventId: string) => Promise<boolean>;
  recordPayment: (eventId: string, kind: string, amountCents: number, intentId: string) => Promise<void>;
  createTip: (input: { eventId: string; djId?: string; customerId?: string; amountCents: number; message?: string; paymentIntentId: string }) => Promise<unknown>;
  boostRequest: (requestId: string, amountCents: number, intentId: string, customerId?: string) => Promise<unknown>;
  afterPayment: (eventId: string, kind: string, amountCents: number, intentId: string) => Promise<void>;
}

const PAYMENT_KINDS = new Set(["deposit", "balance", "final", "other", "retainer", "installment"]);

/**
 * Applies a signature-verified Stripe event exactly once. Payment state only
 * ever changes here, from Stripe's own record of the PaymentIntent — never
 * from a browser redirect or anything the client sends.
 */
export async function processStripeEvent(event: Stripe.Event, deps: StripeHandlerDeps): Promise<{ status: number; result: string }> {
  if (event.type !== "payment_intent.succeeded") return { status: 200, result: "ignored" };
  if (deps.expectLivemode !== null && event.livemode !== deps.expectLivemode) return { status: 200, result: "wrong_mode" };

  const claim = await deps.ledger.claim("stripe", event.id);
  if (claim === "done") return { status: 200, result: "duplicate" };
  if (claim === "busy") return { status: 409, result: "in_progress" }; // Stripe retries later

  try {
    const intent = event.data.object as Stripe.PaymentIntent;
    const meta = intent.metadata ?? {};
    const amount = intent.amount_received || intent.amount;
    if (intent.status !== "succeeded" || !Number.isInteger(amount) || amount <= 0 || (intent.currency ?? "").toLowerCase() !== "usd") {
      await deps.ledger.complete("stripe", event.id);
      return { status: 200, result: "not_applicable" };
    }

    if (meta.type === "tip" && meta.eventId) {
      await deps.createTip({ eventId: meta.eventId, djId: meta.djId || undefined, customerId: meta.customerId || undefined, amountCents: amount, message: meta.message || undefined, paymentIntentId: intent.id });
    } else if (meta.type === "boost" && meta.requestId) {
      await deps.boostRequest(meta.requestId, amount, intent.id, meta.customerId || undefined);
    } else if (meta.type === "event_payment" && meta.eventId) {
      if (!(await deps.eventExists(meta.eventId))) {
        await deps.ledger.complete("stripe", event.id);
        return { status: 200, result: "unknown_event" };
      }
      const kind = PAYMENT_KINDS.has(meta.kind) ? meta.kind : "other";
      try {
        await deps.recordPayment(meta.eventId, kind, amount, intent.id);
      } catch (err) {
        // Unique stripe_payment_intent_id: this payment is already recorded.
        if ((err as { code?: string })?.code !== "23505") throw err;
        await deps.ledger.complete("stripe", event.id);
        return { status: 200, result: "duplicate_payment" };
      }
      await deps.afterPayment(meta.eventId, kind, amount, intent.id);
    }

    await deps.ledger.complete("stripe", event.id);
    return { status: 200, result: "processed" };
  } catch (err) {
    await deps.ledger.release("stripe", event.id);
    throw err;
  }
}
