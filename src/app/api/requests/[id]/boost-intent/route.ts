import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

/**
 * Boosts capture immediately, just like tips. The boost row is written by
 * the Stripe webhook once payment_intent.succeeded fires.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { amountCents, customerId } = body;

  if (!amountCents || amountCents <= 0) {
    return NextResponse.json({ error: "a positive amountCents is required" }, { status: 400 });
  }

  const intent = await getStripe().paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    capture_method: "automatic",
    metadata: { type: "boost", requestId: id, customerId: customerId ?? "" },
  });

  return NextResponse.json({ clientSecret: intent.client_secret, paymentIntentId: intent.id });
}
