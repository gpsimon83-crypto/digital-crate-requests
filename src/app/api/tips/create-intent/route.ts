import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

/**
 * Tips capture immediately (capture_method: automatic). The tip row itself
 * is written by the Stripe webhook once payment_intent.succeeded fires,
 * so we never record money that didn't actually land.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { eventId, djId, customerId, amountCents, message } = body;

  if (!eventId || !amountCents || amountCents <= 0) {
    return NextResponse.json({ error: "eventId and a positive amountCents are required" }, { status: 400 });
  }

  const intent = await getStripe().paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    capture_method: "automatic",
    metadata: {
      type: "tip",
      eventId,
      djId: djId ?? "",
      customerId: customerId ?? "",
      message: message ?? "",
    },
  });

  return NextResponse.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
}
