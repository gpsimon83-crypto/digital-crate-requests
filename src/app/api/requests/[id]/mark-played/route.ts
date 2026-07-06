import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { markRequestPlayed } from "@/lib/data/requests";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/require-auth";

/**
 * Marking a paid request as played is the only moment its authorization
 * gets captured. Free/unplayed/declined requests never charge the guest.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await params;
  const db = createAdminClient();
  const { data: existing } = await db.from("song_requests").select("payment_intent_id, is_paid").eq("id", id).single();

  if (existing?.is_paid && existing.payment_intent_id) {
    await getStripe().paymentIntents.capture(existing.payment_intent_id);
  }

  const updated = await markRequestPlayed(id);
  return NextResponse.json({ request: updated });
}
