import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { createSongRequest } from "@/lib/data/requests";

/**
 * Paid requests authorize only — capture happens in /mark-played once the
 * DJ actually plays the song. Free requests skip Stripe entirely.
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { eventId, songTitle, artist, amountCents = 0, customerId } = body;

  if (!eventId || !songTitle) {
    return NextResponse.json({ error: "eventId and songTitle are required" }, { status: 400 });
  }

  if (amountCents <= 0) {
    const request = await createSongRequest({ eventId, songTitle, artist, customerId, isPaid: false });
    return NextResponse.json({ request });
  }

  const intent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: "usd",
    capture_method: "manual",
    metadata: { type: "request", eventId, songTitle, artist: artist ?? "" },
  });

  const request = await createSongRequest({
    eventId,
    songTitle,
    artist,
    customerId,
    isPaid: true,
    amountCents,
    paymentIntentId: intent.id,
  });

  return NextResponse.json({ request, clientSecret: intent.client_secret });
}
