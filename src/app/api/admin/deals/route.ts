import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { listDeals, createDeal, listDealEligibility } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

export async function GET() {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  try {
    const [deals, eligibility] = await Promise.all([listDeals(), listDealEligibility()]);
    return NextResponse.json({ deals, eligibility });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const body = await req.json();
  if (!body.name?.trim() || !body.dealType) {
    return NextResponse.json({ error: "name and dealType are required" }, { status: 400 });
  }

  try {
    const deal = await createDeal({
      name: body.name.trim(),
      description: body.description ?? null,
      deal_type: body.dealType,
      value: body.value ?? null,
      code: body.code || null,
      starts_at: body.startsAt ?? null,
      ends_at: body.endsAt ?? null,
      eligible_event_start: body.eligibleEventStart ?? null,
      eligible_event_end: body.eligibleEventEnd ?? null,
      blackout_dates: body.blackoutDates ?? [],
      min_spend_cents: body.minSpendCents ?? null,
      usage_limit: body.usageLimit ?? null,
      max_discount_cents: body.maxDiscountCents ?? null,
      is_public: body.isPublic ?? true,
      is_stackable: body.isStackable ?? false,
      status: body.status ?? "draft"
    });
    return NextResponse.json({ deal });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
