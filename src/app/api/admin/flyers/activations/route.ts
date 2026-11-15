import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerAdmin, flyerError, setupMissing, uuidOk } from "@/lib/flyers/server";
import { listActivations, setActivation, type ActivationScope } from "@/lib/flyers/activation";
import { flyerEvents } from "@/lib/flyers/data";

/** Which templates are active: company default, each venue's default, event overrides. */
export async function GET() {
  const admin = await flyerAdmin();
  if (admin instanceof NextResponse) return admin;
  try {
    const db = createAdminClient();
    const acts = await listActivations(db);
    const eventIds = acts.filter((a) => a.event_id).map((a) => a.event_id!);
    const { data: ev } = eventIds.length ? await db.from("events").select("id, title, starts_at").in("id", eventIds) : { data: [] };
    const { data: probe, error } = await db.from("flyer_template_activations").select("id").limit(1);
    void probe;
    // Upcoming events, for picking an event override.
    const upcoming = await flyerEvents(db, { djId: null, staff: true, calendar: false });
    return NextResponse.json({ activations: acts, events: ev ?? [], upcoming, ready: !error });
  } catch (err) {
    return flyerError(err);
  }
}

/** Activate a template (or clear an activation with templateId: null). */
export async function POST(req: NextRequest) {
  const admin = await flyerAdmin();
  if (admin instanceof NextResponse) return admin;
  const b = (await req.json().catch(() => ({}))) as { scope?: string; templateId?: string | null; venueId?: string; eventId?: string };
  const scope = (["company", "venue", "event"] as const).find((s) => s === b.scope) as ActivationScope | undefined;
  if (!scope) return NextResponse.json({ error: "Choose company, venue or event." }, { status: 400 });
  if (scope === "venue" && !uuidOk(b.venueId)) return NextResponse.json({ error: "Choose a venue." }, { status: 400 });
  if (scope === "event" && !uuidOk(b.eventId)) return NextResponse.json({ error: "Choose an event." }, { status: 400 });
  if (b.templateId !== null && !uuidOk(b.templateId)) return NextResponse.json({ error: "Choose a template." }, { status: 400 });
  try {
    const db = createAdminClient();
    if (b.templateId) {
      const { data: t } = await db.from("flyer_templates").select("status, current_version_id").eq("id", b.templateId).maybeSingle();
      if (!t || t.status !== "published" || !t.current_version_id) return NextResponse.json({ error: "Publish the template before activating it." }, { status: 400 });
    }
    await setActivation(db, { scope, venueId: b.venueId ?? null, eventId: b.eventId ?? null, templateId: b.templateId ?? null, userId: admin.user.id });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (setupMissing(err)) return NextResponse.json({ error: "Template activation needs migration 0052_flyer_event_links.sql in Supabase.", setup: true }, { status: 503 });
    return flyerError(err);
  }
}
