import { NextRequest, NextResponse } from "next/server";
import { SHARE_MODES, type ShareMode } from "@/lib/flyers/sharing";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerAdmin, flyerError, uuidOk } from "@/lib/flyers/server";
import { publicAssets } from "@/lib/flyers/server";
import { parseTemplateContent } from "@/lib/flyers/scene";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const admin = await flyerAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  if (!uuidOk(id)) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("flyer_templates").select("id, slug, name, description, venue_id, status, current_version_id, draft, updated_at").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!data) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    const { data: versions } = await db.from("flyer_template_versions").select("id, version, published_at").eq("template_id", id).order("version", { ascending: false });
    const { data: shared } = await db.from("flyer_assets").select("*").eq("scope", "template").order("created_at", { ascending: false }).limit(300);
    const { data: venues } = await db.from("venues").select("id, name, logo_url").order("name");
    const { data: djs } = await db.from("djs").select("id, display_name, photo_url").order("display_name");
    return NextResponse.json({
      template: data,
      versions: versions ?? [],
      shared: publicAssets(shared),
      venues: ((venues ?? []) as { id: string; name: string; logo_url: string | null }[]).map((v) => ({ id: v.id, name: v.name, has_logo: !!v.logo_url })),
      djs: ((djs ?? []) as { id: string; display_name: string; photo_url: string | null }[]).map((d) => ({ id: d.id, display_name: d.display_name, has_photo: !!d.photo_url }))
    });
  } catch (err) {
    return flyerError(err);
  }
}

/** Save the working draft (name, details, venue, layouts). Published versions are never touched. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const admin = await flyerAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  if (!uuidOk(id)) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as { name?: unknown; description?: unknown; venueId?: unknown; draft?: unknown; status?: unknown; shareMode?: unknown; sharedDjIds?: unknown };
  if (b.shareMode !== undefined && !SHARE_MODES.includes(b.shareMode as ShareMode)) return NextResponse.json({ error: "Pick All DJs, chosen DJs or Office only." }, { status: 400 });
  const sharedDjIds = Array.isArray(b.sharedDjIds) ? [...new Set(b.sharedDjIds.filter((x): x is string => typeof x === "string" && uuidOk(x)))].slice(0, 500) : undefined;
  if (b.shareMode === "selected" && sharedDjIds && sharedDjIds.length === 0) return NextResponse.json({ error: "Pick at least one DJ, or choose Office only." }, { status: 400 });
  const update: Record<string, unknown> = { updated_by: admin.user.id, updated_at: new Date().toISOString() };
  if (typeof b.name === "string") {
    const n = b.name.trim().slice(0, 80);
    if (!n) return NextResponse.json({ error: "Give the template a name." }, { status: 400 });
    update.name = n;
  }
  if (typeof b.description === "string") update.description = b.description.trim().slice(0, 300) || null;
  if (b.venueId === null || (typeof b.venueId === "string" && uuidOk(b.venueId))) update.venue_id = b.venueId;
  if (b.draft !== undefined) {
    const p = parseTemplateContent(b.draft);
    if (!p.ok) return NextResponse.json({ error: p.error }, { status: 400 });
    update.draft = p.value;
  }
  try {
    const db = createAdminClient();
    if (b.status === "archived" || b.status === "published") {
      const { data: t } = await db.from("flyer_templates").select("current_version_id").eq("id", id).maybeSingle();
      if (b.status === "published" && !t?.current_version_id) return NextResponse.json({ error: "Publish the template first." }, { status: 400 });
      update.status = b.status;
    }
    if (b.shareMode !== undefined) update.share_mode = b.shareMode;
    const { data, error } = await db.from("flyer_templates").update(update).eq("id", id).select("id, updated_at, status").maybeSingle();
    if (error) {
      if (b.shareMode !== undefined && /share_mode/.test(error.message ?? "")) return NextResponse.json({ error: "Run migration 0068_flyer_template_sharing.sql in Supabase to choose who gets templates." }, { status: 503 });
      throw error;
    }
    if (!data) return NextResponse.json({ error: "Template not found" }, { status: 404 });
    if (sharedDjIds) {
      // Replace the list: who this template is shared with when it's set to chosen DJs.
      const del = await db.from("flyer_template_shares").delete().eq("template_id", id);
      if (del.error) throw del.error;
      if (sharedDjIds.length) {
        const ins = await db.from("flyer_template_shares").insert(sharedDjIds.map((dj_id) => ({ template_id: id, dj_id })));
        if (ins.error) throw ins.error;
      }
    }
    return NextResponse.json({ ok: true, updated_at: data.updated_at, status: data.status });
  } catch (err) {
    return flyerError(err);
  }
}

/** Delete a template nobody has used; once a flyer uses it, it can only be archived (hidden from DJs). */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const admin = await flyerAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  if (!uuidOk(id)) return NextResponse.json({ error: "Template not found" }, { status: 404 });
  try {
    const db = createAdminClient();
    const { count } = await db.from("flyer_designs").select("id", { count: "exact", head: true }).eq("template_id", id);
    if ((count ?? 0) > 0) {
      await db.from("flyer_templates").update({ status: "archived", updated_by: admin.user.id }).eq("id", id);
      return NextResponse.json({ ok: true, archived: true });
    }
    await db.from("flyer_templates").update({ current_version_id: null }).eq("id", id);
    await db.from("flyer_template_versions").delete().eq("template_id", id);
    const { error } = await db.from("flyer_templates").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true, deleted: true });
  } catch (err) {
    return flyerError(err);
  }
}
