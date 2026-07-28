import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createTip, boostRequest } from "@/lib/data/requests";
import { recordSucceededPayment } from "@/lib/data/payments";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err}` }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const { type, eventId, djId, customerId, message, requestId, kind } = intent.metadata;

    if (type === "tip" && eventId) {
      await createTip({
        eventId,
        djId: djId || undefined,
        customerId: customerId || undefined,
        amountCents: intent.amount,
        message: message || undefined,
        paymentIntentId: intent.id,
      });
    }

    if (type === "boost" && requestId) {
      await boostRequest(requestId, intent.amount, intent.id, customerId || undefined);
    }

    if (type === "event_payment" && eventId) {
      try {
        await recordSucceededPayment(eventId, kind || "other", intent.amount, intent.id);
      } catch (err) {
        // Stripe can redeliver the same webhook — a unique-constraint hit
        // on stripe_payment_intent_id means this payment was already
        // recorded, which is a safe no-op, not a real failure.
        const isDuplicate = typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "23505";
        if (!isDuplicate) throw err;
      }
    }
    // type === "request": the song_request row was already created at
    // authorization time in /api/requests/create-intent; nothing to do here
    // until the DJ marks it played (capture) or declines it (cancel).
  }

  return NextResponse.json({ received: true });
}
