import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createTip, boostRequest } from "@/lib/data/requests";
import { recordSucceededPayment } from "@/lib/data/payments";
import { logActivity } from "@/lib/activity";
import { runAutomations } from "@/lib/automations-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { processStripeEvent } from "@/lib/security/stripe-webhook";
import { supabaseWebhookLedger } from "@/lib/security/webhook-idempotency";

export async function POST(req: NextRequest) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    console.error("Stripe webhook received but STRIPE_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, signature ?? "", secret);
  } catch {
    return NextResponse.json({ error: "Webhook signature verification failed" }, { status: 400 });
  }

  const key = process.env.STRIPE_SECRET_KEY ?? "";
  const origin = req.nextUrl.origin;
  try {
    const r = await processStripeEvent(event, {
      ledger: supabaseWebhookLedger,
      expectLivemode: key.startsWith("sk_live") || key.startsWith("rk_live") ? true : key.startsWith("sk_test") || key.startsWith("rk_test") ? false : null,
      eventExists: async (id) => {
        const { data } = await createAdminClient().from("events").select("id").eq("id", id).maybeSingle();
        return !!data;
      },
      recordPayment: recordSucceededPayment,
      createTip,
      boostRequest,
      afterPayment: async (eventId, kind, amountCents, intentId) => {
        await logActivity({ actorLabel: "Stripe", action: "payment.received", entityType: "payment", entityId: intentId, eventId, metadata: { kind, amountCents } });
        await runAutomations("payment_received", eventId, origin, { payment_kind: kind });
      }
    });
    return NextResponse.json({ received: true, result: r.result }, { status: r.status });
  } catch (err) {
    console.error("Stripe webhook processing failed", event.id, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
