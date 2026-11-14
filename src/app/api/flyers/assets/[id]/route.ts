import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { assetUsage, cleanFolder, FLYER_BUCKET, flyerActor, flyerError, imageResponse, publicAsset, setupMissing, uuidOk, type FlyerActor } from "@/lib/flyers/server";

type Params = { params: Promise<{ id: string }> };
type AssetRow = { id: string; scope: "template" | "dj"; owner_dj_id: string | null; storage_path: string; mime: string };

async function load(actor: FlyerActor, id: string): Promise<AssetRow | NextResponse> {
  if (!uuidOk(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { data, error } = await createAdminClient().from("flyer_assets").select("id, scope, owner_dj_id, storage_path, mime").eq("id", id).maybeSingle();
  if (error) throw error;
  const row = data as AssetRow | null;
  // Template assets: any DJ or staff. A DJ's upload: that DJ and staff only.
  if (!row || (row.scope === "dj" && !actor.staff && row.owner_dj_id !== actor.dj?.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return row;
}

/** Serves the original image from the private bucket, same-origin (so the canvas can export it). */
export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const row = await load(actor, (await params).id);
    if (row instanceof NextResponse) return row;
    const { data, error } = await createAdminClient().storage.from(FLYER_BUCKET).download(row.storage_path);
    if (error || !data) return NextResponse.json({ error: "Image missing" }, { status: 404 });
    return imageResponse(data, row.mime, 3600);
  } catch (err) {
    return flyerError(err);
  }
}

/** Rename, move to a folder, or change what kind of image it is. */
export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const row = await load(actor, (await params).id);
    if (row instanceof NextResponse) return row;
    if (row.scope === "template" && !actor.staff) return NextResponse.json({ error: "Only staff can change template art." }, { status: 403 });
    const b = (await req.json().catch(() => ({}))) as { name?: unknown; folder?: unknown; kind?: unknown };
    const update: Record<string, unknown> = {};
    if (typeof b.name === "string") update.name = b.name.replace(/[^\w .()&'-]+/g, "").trim().slice(0, 120) || null;
    if (b.folder === null || typeof b.folder === "string") update.folder = cleanFolder(b.folder);
    if (typeof b.kind === "string") {
      const allowed = row.scope === "dj" ? ["photo", "image"] : ["background", "overlay", "logo", "image"];
      if (!allowed.includes(b.kind)) return NextResponse.json({ error: "Unknown image type." }, { status: 400 });
      update.kind = b.kind;
    }
    if (!Object.keys(update).length) return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
    if ("folder" in update) update.updated_at = new Date().toISOString();
    const { data, error } = await createAdminClient().from("flyer_assets").update(update).eq("id", row.id).select("*").single();
    if (error) {
      if (setupMissing(error)) return NextResponse.json({ error: "Folders need migration 0051_flyer_asset_folders.sql in Supabase.", setup: true }, { status: 503 });
      throw error;
    }
    return NextResponse.json({ asset: publicAsset(data as Record<string, unknown>) });
  } catch (err) {
    return flyerError(err);
  }
}

/**
 * Delete an image. If flyers or templates use it, nothing is deleted and the
 * answer says where it's used; send ?force=1 to delete anyway (those frames
 * then show an empty slot until a new picture is chosen).
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const row = await load(actor, (await params).id);
    if (row instanceof NextResponse) return row;
    if (row.scope === "template" && !actor.staff) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    const db = createAdminClient();
    if (req.nextUrl.searchParams.get("force") !== "1") {
      const usage = await assetUsage(db, row.id);
      if (usage.designs || usage.templates.length || usage.publishedVersions) return NextResponse.json({ error: "This image is in use.", inUse: true, usage }, { status: 409 });
    }
    const { error } = await db.from("flyer_assets").delete().eq("id", row.id);
    if (error) throw error;
    await db.storage.from(FLYER_BUCKET).remove([row.storage_path]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return flyerError(err);
  }
}
