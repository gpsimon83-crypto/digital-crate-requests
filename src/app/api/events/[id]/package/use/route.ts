import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { getTemplateDetail, priceTemplate, saveSelection, defaultSelectionsForTemplate } from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";

/**
 * "Use This Package" — staff or the assigned DJ stages a published
 * template on a client's event with the template's default (included)
 * quantities. It lands in the client's portal exactly where a client's
 * own selection would (getCurrentSelection), ready for them to review,
 * customize, and save/request — never touches events.quoted_amount,
 * same as a client-initiated save.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await req.json();
  const { templateId } = body as { templateId?: string };
  if (!templateId) return NextResponse.json({ error: "templateId is required" }, { status: 400 });

  try {
    const detail = await getTemplateDetail(templateId);
    if (!detail) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const selections = defaultSelectionsForTemplate(detail.sections);
    const breakdown = await priceTemplate(templateId, selections, { eventDate: null, guestCount: null, travelMiles: null, hoursBooked: null });
    if (!breakdown) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const selectionMap: Record<string, number> = {};
    for (const s of selections) selectionMap[s.lineItemId] = s.quantity;

    const selection = await saveSelection(id, {
      packageTemplateId: templateId,
      packageTemplateVersion: detail.template.version,
      status: "draft",
      selections: selectionMap,
      appliedDealIds: [],
      priceSnapshot: breakdown
    });

    return NextResponse.json({ selection });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
