import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { declineRequest } from "@/lib/data/requests";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireRequestEventAccess } from "@/lib/require-event-access";

/**
 * Declined paid requests release the authorization instead of charging it.
 */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireRequestEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });
  const db = createAdminClient();
  const { data: existing } = await db.from("song_requests").select("payment_intent_id, is_paid").eq("id", id).single();

  if (existing?.is_paid && existing.payment_intent_id) {
    await getStripe().paymentIntents.cancel(existing.payment_intent_id).catch(() => {
      // already canceled/captured elsewhere; proceed with the status update regardless
    });
  }

  const updated = await declineRequest(id);
  return NextResponse.json({ request: updated });
}
