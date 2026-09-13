import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClientForAuthUser, getClientEvent } from "@/lib/data/portal";
import { getCurrentSelection, getTemplateDetail } from "@/lib/data/package-builder";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeEventType } from "@/lib/questionnaire-event-type";
import { errorMessage } from "@/lib/error-message";
import type { PackageSectionData } from "@/lib/packages/types";

// Clients never see internal cost/margin or admin-only line items,
// regardless of permission config — this route is a hard boundary.
function forClient(sections: PackageSectionData[]): PackageSectionData[] {
  return sections
    .filter((s) => !s.is_hidden)
    .map((s) => ({
      ...s,
      line_items: s.line_items
        .filter((li) => li.is_client_visible && li.selection_mode !== "hidden")
        .map((li) => ({ ...li, catalog_item: li.catalog_item ? { ...li.catalog_item, internal_cost_cents: null } : null }))
    }));
}

// Resolves what the client should see: published templates for this
// event's type (plus a "start from scratch" option), and any in-progress
// selection to resume.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  try {
    const client = await getClientForAuthUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record linked to this account" }, { status: 403 });

    const event = await getClientEvent(client.id, id);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const eventType = normalizeEventType(event.event_type);
    const db = createAdminClient();
    let query = db.from("package_templates").select("id, name, tier, description, status, display_mode, base_price_cents, icon, image_url").eq("status", "published");
    if (eventType) query = query.eq("event_type", eventType);
    const { data: templates, error } = await query.order("position");
    if (error) throw error;

    const selection = await getCurrentSelection(id);
    const requestedTemplateId = req.nextUrl.searchParams.get("templateId");
    const detailTemplateId = requestedTemplateId ?? selection?.package_template_id ?? null;

    let templateDetail = null;
    if (detailTemplateId) {
      const detail = await getTemplateDetail(detailTemplateId, event.dj_id);
      if (detail) templateDetail = { ...detail, sections: forClient(detail.sections) };
    }

    return NextResponse.json({ templates: templates ?? [], selection, templateDetail });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
