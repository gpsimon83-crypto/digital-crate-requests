import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOwnStorageImage, FLYER_BUCKET, flyerActor, flyerError, imageResponse, uuidOk } from "@/lib/flyers/server";
import { preferredDjAsset } from "@/lib/flyers/dj-assets";

type Params = { params: Promise<{ djId: string }> };

/**
 * The picture for a DJ photo slot, served same-origin for the canvas: the
 * DJ's preferred approved transparent cutout, else their saved profile photo.
 * Any DJ or staff can load it (a flyer can feature several DJs; these are the
 * DJ's public promo pictures).
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  const { djId } = await params;
  if (!uuidOk(djId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const db = createAdminClient();
    const cut = await preferredDjAsset(db, djId, "cutout");
    if (cut) {
      const { data } = await db.storage.from(FLYER_BUCKET).download(cut.storage_path);
      if (data) return imageResponse(data, cut.mime, 120);
    }
    const { data } = await db.from("djs").select("photo_url").eq("id", djId).maybeSingle();
    const res = await fetchOwnStorageImage((data as { photo_url: string | null } | null)?.photo_url);
    if (!res) return NextResponse.json({ error: "No photo" }, { status: 404 });
    return imageResponse(await res.arrayBuffer(), res.headers.get("content-type") ?? "image/jpeg", 120);
  } catch (err) {
    return flyerError(err);
  }
}
