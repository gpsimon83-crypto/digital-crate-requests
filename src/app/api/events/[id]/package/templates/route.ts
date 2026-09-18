import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

// Published templates matching this event's type — same access rule as
// the rest of a project's data (staff, or the assigned DJ). Lets a DJ
// browse what's available to push into a client's portal.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const db = createAdminClient();
    const { data: event } = await db.from("events").select("event_category").eq("id", id).maybeSingle();

    let query = db
      .from("package_templates")
      .select("id, name, tier, description, status, display_mode, base_price_cents, icon, image_url, event_type")
      .eq("status", "published");
    if (event?.event_category) query = query.eq("event_type", event.event_category);
    const { data: templates, error } = await query.order("position");
    if (error) throw error;

    return NextResponse.json({ templates: templates ?? [] });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
