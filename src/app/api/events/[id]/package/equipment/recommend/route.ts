import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { getResponse } from "@/lib/data/questionnaires";
import {
  recommendEquipmentForTemplate,
  priceTemplate,
  saveSelection,
  getCurrentSelection,
  getTemplateDetail,
  defaultSelectionsForTemplate
} from "@/lib/data/package-builder";
import { errorMessage } from "@/lib/error-message";
import type { GigContext } from "@/lib/packages/gig-calculator";

/**
 * "Recommend Equipment" — runs the gig equipment calculator against this
 * event's real details (guest count, event type, questionnaire answers)
 * and raises the matched line items' locked minimums on the current
 * selection. Available to staff and the assigned DJ (same access as the
 * rest of a project), but the *rules themselves* are owner/admin only —
 * this route only ever applies rules someone else already authored.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  const body = await req.json();
  const { templateId } = body as { templateId?: string };
  if (!templateId) return NextResponse.json({ error: "templateId is required" }, { status: 400 });

  try {
    const db = createAdminClient();
    const { data: event } = await db.from("events").select("event_type, expected_guests, starts_at, ends_at").eq("id", id).maybeSingle();
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const response = await getResponse(id);
    let hoursBooked: number | null = null;
    if (event.starts_at && event.ends_at) {
      hoursBooked = (new Date(event.ends_at).getTime() - new Date(event.starts_at).getTime()) / 3_600_000;
    }

    const ctx: GigContext = {
      guestCount: event.expected_guests ?? null,
      eventType: event.event_type ?? null,
      hoursBooked,
      answers: (response?.answers as Record<string, unknown>) ?? {}
    };

    const { matched, unmatched } = await recommendEquipmentForTemplate(templateId, ctx);

    const existing = await getCurrentSelection(id);
    const detail = await getTemplateDetail(templateId);
    if (!detail) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    const baseSelections: Record<string, number> = existing?.selections ?? Object.fromEntries(defaultSelectionsForTemplate(detail.sections).map((s) => [s.lineItemId, s.quantity]));
    const lockedMinimums: Record<string, number> = { ...(existing?.locked_minimums ?? {}) };
    const selections = { ...baseSelections };

    for (const m of matched) {
      lockedMinimums[m.lineItemId] = Math.max(lockedMinimums[m.lineItemId] ?? 0, m.quantity);
      selections[m.lineItemId] = Math.max(selections[m.lineItemId] ?? 0, m.quantity);
    }

    const selectionInputs = Object.entries(selections).map(([lineItemId, quantity]) => ({ lineItemId, quantity }));
    const breakdown = await priceTemplate(templateId, selectionInputs, {
      eventDate: event.starts_at ? String(event.starts_at).slice(0, 10) : null,
      guestCount: ctx.guestCount,
      travelMiles: null,
      hoursBooked: ctx.hoursBooked
    });
    if (!breakdown) return NextResponse.json({ error: "Template not found" }, { status: 404 });

    // If this selection was already staff-confirmed, changing what
    // equipment is in it means the confirmed number no longer reflects
    // reality — reopen it to "saved" so a fresh approve action is
    // required before it can be paid against again.
    const nextStatus = existing?.status === "requested" ? "requested" : "saved";

    const selection = await saveSelection(id, {
      packageTemplateId: templateId,
      packageTemplateVersion: detail.template.version,
      status: nextStatus,
      selections,
      appliedDealIds: existing?.applied_deal_ids ?? [],
      priceSnapshot: breakdown,
      lockedMinimums
    });

    return NextResponse.json({ matched, unmatched, selection });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
