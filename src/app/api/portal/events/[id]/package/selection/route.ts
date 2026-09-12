import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClientForAuthUser, getClientEvent } from "@/lib/data/portal";
import { priceTemplate, saveSelection, getTemplateDetail } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";
import type { SelectionInput, EventPricingContext } from "@/lib/packages/types";

// "Save My Quote" / "Request This Package" — both write a selection with
// a server-recomputed price_snapshot. Neither touches events.quoted_amount;
// that only happens via the separate, explicit staff approval action.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { templateId, status } = body as { templateId?: string; status?: "draft" | "saved" | "requested" };
  if (!templateId) return NextResponse.json({ error: "templateId is required" }, { status: 400 });
  if (!status || !["draft", "saved", "requested"].includes(status)) {
    return NextResponse.json({ error: "status must be draft, saved, or requested" }, { status: 400 });
  }

  try {
    const client = await getClientForAuthUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record linked to this account" }, { status: 403 });
    const event = await getClientEvent(client.id, id);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const detail = await getTemplateDetail(templateId);
    if (!detail) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const selections = (body.selections ?? []) as SelectionInput[];
    const selectionMap: Record<string, number> = {};
    for (const s of selections) selectionMap[s.lineItemId] = s.quantity;

    const eventContext: EventPricingContext = {
      eventDate: event.starts_at ? String(event.starts_at).slice(0, 10) : null,
      guestCount: event.expected_guests ?? null,
      travelMiles: body.eventContext?.travelMiles ?? null,
      hoursBooked: body.eventContext?.hoursBooked ?? null
    };

    const breakdown = await priceTemplate(templateId, selections, eventContext, body.appliedDealIds);
    if (!breakdown) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const selection = await saveSelection(id, {
      packageTemplateId: templateId,
      packageTemplateVersion: detail.template.version,
      status,
      selections: selectionMap,
      appliedDealIds: body.appliedDealIds ?? [],
      priceSnapshot: breakdown
    });

    return NextResponse.json({ selection });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
