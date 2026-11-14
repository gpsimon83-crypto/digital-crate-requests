import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FLYER_BUCKET, flyerActor, flyerError, imageResponse, uuidOk, type FlyerActor } from "@/lib/flyers/server";

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

/** Remove an upload. Flyers that used it show an empty frame until a new image is chosen. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const row = await load(actor, (await params).id);
    if (row instanceof NextResponse) return row;
    if (row.scope === "template" && !actor.staff) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
    const db = createAdminClient();
    const { error } = await db.from("flyer_assets").delete().eq("id", row.id);
    if (error) throw error;
    await db.storage.from(FLYER_BUCKET).remove([row.storage_path]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return flyerError(err);
  }
}
