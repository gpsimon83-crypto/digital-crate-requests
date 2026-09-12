import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { updateDeal, deleteDeal } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const patch: Record<string, unknown> = {};
  const map: Record<string, string> = {
    name: "name",
    description: "description",
    dealType: "deal_type",
    value: "value",
    code: "code",
    startsAt: "starts_at",
    endsAt: "ends_at",
    eligibleEventStart: "eligible_event_start",
    eligibleEventEnd: "eligible_event_end",
    blackoutDates: "blackout_dates",
    minSpendCents: "min_spend_cents",
    usageLimit: "usage_limit",
    maxDiscountCents: "max_discount_cents",
    isPublic: "is_public",
    isStackable: "is_stackable",
    status: "status"
  };
  for (const [key, column] of Object.entries(map)) {
    if (body[key] !== undefined) patch[column] = body[key];
  }

  try {
    const deal = await updateDeal(id, patch);
    return NextResponse.json({ deal });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  try {
    await deleteDeal(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
