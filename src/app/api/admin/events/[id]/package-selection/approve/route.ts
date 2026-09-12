import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { getCurrentSelection, approveSelectionForPayment } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

// Explicit staff action — copies the current selection's server-computed
// price_snapshot into events.quoted_amount/deposit_amount so the existing
// Payment tab / pay-intent flow can take over. Never automatic.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id: eventId } = await params;
  try {
    const selection = await getCurrentSelection(eventId);
    if (!selection) return NextResponse.json({ error: "No package selection for this event" }, { status: 404 });
    await approveSelectionForPayment(selection.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
