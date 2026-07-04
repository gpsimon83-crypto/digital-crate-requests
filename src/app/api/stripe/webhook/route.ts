import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createTip, boostRequest } from "@/lib/data/requests";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature ?? "", process.env.STRIPE_WEBHOOK_SECRET ?? "");
  } catch (err) {
    return NextResponse.json({ error: `Webhook signature verification failed: ${err}` }, { status: 400 });
  }

  if (event.type === "payment_intent.succeeded") {
    const intent = event.data.object as Stripe.PaymentIntent;
    const { type, eventId, djId, customerId, message, requestId } = intent.metadata;

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
    // type === "request": the song_request row was already created at
    // authorization time in /api/requests/create-intent; nothing to do here
    // until the DJ marks it played (capture) or declines it (cancel).
  }

  return NextResponse.json({ received: true });
}
