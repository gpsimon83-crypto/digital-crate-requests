import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerAdmin, flyerError, uuidOk } from "@/lib/flyers/server";
import { listActivations, type Activation } from "@/lib/flyers/activation";
import { loadFlyerContext } from "@/lib/flyers/data";
import { applyTemplateKeepingOverrides } from "@/lib/flyers/links";
import { parseScene, parseTemplateContent } from "@/lib/flyers/scene";
import type { FormatKey, Scene, TemplateContent } from "@/lib/flyers/types";

type Draft = { id: string; dj_id: string; event_id: string | null; venue_id?: string | null; dj_slots?: (string | null)[] | null; format: FormatKey; scene: Scene; template_id: string | null; exported_at?: string | null };

/**
 * Drafts whose active template is now this one but which use a different
 * template. Exported flyers are never included.
 */
async function affected(db: ReturnType<typeof createAdminClient>, templateId: string) {
  const acts = await listActivations(db);
  const { data, error } = await db.from("flyer_designs").select("*").is("exported_at", null).limit(2000);
  if (error) throw error;
  const drafts = ((data ?? []) as Draft[]).filter((d) => d.template_id !== templateId);
  const eventIds = [...new Set(drafts.map((d) => d.event_id).filter((x): x is string => !!x))];
  const { data: ev } = eventIds.length ? await db.from("events").select("id, venue_id").in("id", eventIds) : { data: [] };
  const venueOf = new Map(((ev ?? []) as { id: string; venue_id: string | null }[]).map((e) => [e.id, e.venue_id]));
  const pick = (a?: Activation) => a?.template_id ?? null;
  return drafts.filter((d) => {
    const venueId = (d.event_id ? venueOf.get(d.event_id) : null) ?? d.venue_id ?? null;
    const active =
      (d.event_id && pick(acts.find((a) => a.scope === "event" && a.event_id === d.event_id))) ||
      (venueId && pick(acts.find((a) => a.scope === "venue" && a.venue_id === venueId))) ||
      pick(acts.find((a) => a.scope === "company"));
    return active === templateId;
  });
}

/** How many drafts applying would change. */
export async function GET(req: NextRequest) {
  const admin = await flyerAdmin();
  if (admin instanceof NextResponse) return admin;
  const id = req.nextUrl.searchParams.get("template");
  if (!uuidOk(id)) return NextResponse.json({ error: "Choose a template." }, { status: 400 });
  try {
    return NextResponse.json({ drafts: (await affected(createAdminClient(), id)).length });
  } catch (err) {
    return flyerError(err);
  }
}

/** Apply the newly activated template to those drafts, keeping each flyer's own overrides. */
export async function POST(req: NextRequest) {
  const admin = await flyerAdmin();
  if (admin instanceof NextResponse) return admin;
  const b = (await req.json().catch(() => ({}))) as { templateId?: string };
  if (!uuidOk(b.templateId)) return NextResponse.json({ error: "Choose a template." }, { status: 400 });
  try {
    const db = createAdminClient();
    const { data: t } = await db.from("flyer_templates").select("id, current_version_id").eq("id", b.templateId).maybeSingle();
    if (!t?.current_version_id) return NextResponse.json({ error: "That template isn't published." }, { status: 400 });
    const { data: v } = await db.from("flyer_template_versions").select("id, content").eq("id", t.current_version_id).single();
    const content = parseTemplateContent((v as { content: TemplateContent }).content);
    if (!content.ok) return NextResponse.json({ error: content.error }, { status: 500 });
    let applied = 0;
    let skipped = 0;
    for (const d of await affected(db, b.templateId)) {
      const layout = content.value.formats[d.format];
      if (!layout) {
        skipped += 1; // the template has no layout in this flyer's size
        continue;
      }
      const prev = parseScene(d.scene, d.format);
      const ctx = await loadFlyerContext(db, { eventId: d.event_id, venueId: d.venue_id ?? null, djSlots: Array.isArray(d.dj_slots) ? d.dj_slots : null, fallbackDjId: d.dj_id });
      const scene = applyTemplateKeepingOverrides(prev.ok ? prev.value : layout, layout, { values: ctx.values, slots: ctx.slots, venueId: ctx.venue?.id ?? null, hasEvent: ctx.hasEvent });
      const { error } = await db.from("flyer_designs").update({ scene, template_id: t.id, template_version_id: v!.id, updated_by: admin.user.id, updated_at: new Date().toISOString() }).eq("id", d.id).is("exported_at", null);
      if (error) throw error;
      applied += 1;
    }
    return NextResponse.json({ ok: true, applied, skipped });
  } catch (err) {
    return flyerError(err);
  }
}
