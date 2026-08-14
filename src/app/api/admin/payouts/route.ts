import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { listPayouts, createPayout } from "@/lib/data/payouts";
import { requirePermission } from "@/lib/require-permission";

export async function GET() {
  const denied = await requirePermission("finance.view_company");
  if (denied) return denied;

  try {
    const payouts = await listPayouts();
    return NextResponse.json({ payouts });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requirePermission("finance.manage");
  if (denied) return denied;

  const body = await req.json();
  const { eventId, djId, amountCents, notes } = body as { eventId?: string; djId?: string; amountCents?: number; notes?: string };
  if (!eventId || !djId || !amountCents || amountCents <= 0) {
    return NextResponse.json({ error: "eventId, djId, and a positive amountCents are required" }, { status: 400 });
  }

  try {
    const payout = await createPayout({ eventId, djId, amountCents, notes });
    return NextResponse.json({ payout });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
