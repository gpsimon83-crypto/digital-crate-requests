import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkSceneSources, flyerActor, flyerError, uuidOk, type FlyerActor } from "@/lib/flyers/server";
import { publicAssets } from "@/lib/flyers/server";
import { checkDjChanges, parseScene } from "@/lib/flyers/scene";
import type { FormatKey, Scene } from "@/lib/flyers/types";

type Params = { params: Promise<{ id: string }> };
type DesignRow = { id: string; dj_id: string; title: string; format: FormatKey; width: number; height: number; scene: Scene; event_id: string | null; template_id: string | null; template_version_id: string | null; updated_at: string };

/** A DJ reaches only their own flyers; staff reach every flyer. Anyone else gets "not found". */
async function load(actor: FlyerActor, id: string): Promise<DesignRow | NextResponse> {
  if (!uuidOk(id)) return NextResponse.json({ error: "Flyer not found" }, { status: 404 });
  const { data, error } = await createAdminClient()
    .from("flyer_designs")
    .select("id, dj_id, title, format, width, height, scene, event_id, template_id, template_version_id, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  const row = data as DesignRow | null;
  if (!row || (!actor.staff && row.dj_id !== actor.dj?.id)) return NextResponse.json({ error: "Flyer not found" }, { status: 404 });
  return row;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const row = await load(actor, (await params).id);
    if (row instanceof NextResponse) return row;
    const db = createAdminClient();
    const { data: dj } = await db.from("djs").select("id, display_name, photo_url").eq("id", row.dj_id).maybeSingle();
    const { data: uploads } = await db.from("flyer_assets").select("*").eq("scope", "dj").eq("owner_dj_id", row.dj_id).order("created_at", { ascending: false }).limit(100);
    const { data: shared } = await db.from("flyer_assets").select("*").eq("scope", "template").order("created_at", { ascending: false }).limit(200);
    const { data: venues } = await db.from("venues").select("id, name, logo_url").order("name");
    let template: { name: string; version: number | null } | null = null;
    if (row.template_id) {
      const { data: t } = await db.from("flyer_templates").select("name").eq("id", row.template_id).maybeSingle();
      const { data: v } = row.template_version_id ? await db.from("flyer_template_versions").select("version").eq("id", row.template_version_id).maybeSingle() : { data: null };
      template = t ? { name: t.name as string, version: (v?.version as number) ?? null } : null;
    }
    const d = dj as { id: string; display_name: string; photo_url: string | null } | null;
    return NextResponse.json({
      design: row,
      template,
      owner: d ? { id: d.id, display_name: d.display_name, has_photo: !!d.photo_url } : null,
      // Staff working on another DJ's flyer: their own layers stay theirs, template permissions still apply to the DJ.
      viewer: { staff: actor.staff, isOwner: row.dj_id === actor.dj?.id },
      uploads: publicAssets(uploads),
      shared: publicAssets(shared),
      venues: ((venues ?? []) as { id: string; name: string; logo_url: string | null }[]).map((v) => ({ id: v.id, name: v.name, has_logo: !!v.logo_url }))
    });
  } catch (err) {
    return flyerError(err);
  }
}

/** Autosave / save. Checks the scene, the images it uses, and the template's layer permissions. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const row = await load(actor, (await params).id);
    if (row instanceof NextResponse) return row;
    const b = (await req.json().catch(() => ({}))) as { scene?: unknown; title?: unknown; baseUpdatedAt?: unknown };
    const update: Record<string, unknown> = { updated_by: actor.user.id, updated_at: new Date().toISOString() };

    if (typeof b.title === "string") update.title = b.title.trim().slice(0, 80) || "Untitled flyer";
    if (b.scene !== undefined) {
      const parsed = parseScene(b.scene, row.format);
      if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
      const prev = parseScene(row.scene, row.format);
      if (!actor.staff && prev.ok) {
        const problem = checkDjChanges(prev.value, parsed.value);
        if (problem) return NextResponse.json({ error: problem }, { status: 403 });
      }
      const db = createAdminClient();
      const bad = await checkSceneSources(db, parsed.value, row.dj_id);
      if (bad) return NextResponse.json({ error: bad }, { status: 400 });
      update.scene = parsed.value;
    }
    // Two tabs editing the same flyer: refuse to overwrite a newer save.
    const db = createAdminClient();
    let q = db.from("flyer_designs").update(update).eq("id", row.id);
    if (typeof b.baseUpdatedAt === "string") q = q.eq("updated_at", b.baseUpdatedAt);
    const { data, error } = await q.select("id, updated_at, title").maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "This flyer was changed in another window. Reload to get the latest version.", conflict: true }, { status: 409 });
    return NextResponse.json({ ok: true, updated_at: data.updated_at, title: data.title });
  } catch (err) {
    return flyerError(err);
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const row = await load(actor, (await params).id);
    if (row instanceof NextResponse) return row;
    const { error } = await createAdminClient().from("flyer_designs").delete().eq("id", row.id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return flyerError(err);
  }
}
