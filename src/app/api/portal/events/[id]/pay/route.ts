import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createClient } from "@/lib/supabase/server";
import { getClientForAuthUser, getClientEvent } from "@/lib/data/portal";
import { listEventPayments, computeBalance } from "@/lib/data/payments";
import { getStripe } from "@/lib/stripe";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { kind, amountCents } = body as { kind?: string; amountCents?: number };

  if (!kind || !["deposit", "balance", "other"].includes(kind) || typeof amountCents !== "number" || !Number.isInteger(amountCents) || amountCents < 50) {
    return NextResponse.json({ error: "Choose a payment type and an amount of at least $0.50." }, { status: 400 });
  }

  try {
    const client = await getClientForAuthUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record linked to this account" }, { status: 403 });

    const event = await getClientEvent(client.id, id);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const payments = await listEventPayments(id);
    const { balanceCents } = computeBalance(event, payments);

    if (amountCents > balanceCents) {
      return NextResponse.json({ error: `That's more than the remaining balance ($${(balanceCents / 100).toFixed(2)})` }, { status: 400 });
    }

    const intent = await getStripe().paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      capture_method: "automatic",
      metadata: {
        type: "event_payment",
        eventId: id,
        kind
      }
    });

    return NextResponse.json({ clientSecret: intent.client_secret });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
