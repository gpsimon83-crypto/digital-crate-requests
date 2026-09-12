import { NextRequest, NextResponse } from "next/server";
import { requirePermission } from "@/lib/require-permission";
import { priceTemplate } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";
import type { SelectionInput, EventPricingContext } from "@/lib/packages/types";

// Staff preview pricing — same engine the client builder uses, never a
// client-supplied total. Body: { selections, eventContext, appliedDealIds }.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requirePermission("packages.manage");
  if (denied) return denied;

  const { id } = await params;
  const body = await req.json();
  const selections = (body.selections ?? []) as SelectionInput[];
  const eventContext: EventPricingContext = {
    eventDate: body.eventContext?.eventDate ?? null,
    guestCount: body.eventContext?.guestCount ?? null,
    travelMiles: body.eventContext?.travelMiles ?? null,
    hoursBooked: body.eventContext?.hoursBooked ?? null
  };

  try {
    const breakdown = await priceTemplate(id, selections, eventContext, body.appliedDealIds);
    if (!breakdown) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    return NextResponse.json({ breakdown });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
