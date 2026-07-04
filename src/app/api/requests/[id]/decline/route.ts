import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { declineRequest } from "@/lib/data/requests";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Declined paid requests release the authorization instead of charging it.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = createAdminClient();
  const { data: existing } = await db.from("song_requests").select("payment_intent_id, is_paid").eq("id", id).single();

  if (existing?.is_paid && existing.payment_intent_id) {
    await stripe.paymentIntents.cancel(existing.payment_intent_id).catch(() => {
      // already canceled/captured elsewhere; proceed with the status update regardless
    });
  }

  const updated = await declineRequest(id);
  return NextResponse.json({ request: updated });
}
