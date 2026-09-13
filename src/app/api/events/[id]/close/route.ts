import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { closeEvent } from "@/lib/data/events";
import { requireEventAccess } from "@/lib/require-event-access";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listEventPayments, computeBalance } from "@/lib/data/payments";
import { listPayoutsForEvent, createPayout } from "@/lib/data/payouts";
import { logActivity } from "@/lib/activity";

/**
 * Closing used to just flip the status with no check that the client had
 * actually paid in full — an event could go "completed" with a balance
 * still owed and nothing would flag it. Now blocks (409, with the balance)
 * unless the caller explicitly passes `force: true` for the legitimate
 * cases (writing off a balance, cash paid outside the system).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await req.json().catch(() => ({}));
  const force = body?.force === true;

  try {
    if (!force) {
      const db = createAdminClient();
      const { data: eventRow, error: eventError } = await db
        .from("events")
        .select("quoted_amount, final_amount")
        .eq("id", id)
        .single();
      if (eventError) throw eventError;

      const payments = await listEventPayments(id);
      const { balanceCents } = computeBalance(eventRow, payments);
      if (balanceCents > 0) {
        return NextResponse.json(
          { error: `This event still has a balance of $${(balanceCents / 100).toFixed(2)}. Close it anyway, or collect the rest first.`, balanceCents, requiresForce: true },
          { status: 409 }
        );
      }
    }

    const event = await closeEvent(id);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    await logActivity({ actorUserId: user?.id, action: "event.closed", entityType: "event", entityId: id, eventId: id });

    // No commission/rate formula exists to compute a real payout amount —
    // guessing one (e.g. the full client-facing price) would be a real
    // financial mistake. Instead, leave a $0 pending placeholder so this
    // event surfaces on the admin Payouts list to be filled in, rather
    // than relying on someone remembering to create one manually.
    if (access.event.dj_id) {
      const existing = await listPayoutsForEvent(id);
      if (existing.length === 0) {
        await createPayout({ eventId: id, djId: access.event.dj_id, amountCents: 0, notes: "Auto-created on event close — set the payout amount." });
      }
    }

    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
