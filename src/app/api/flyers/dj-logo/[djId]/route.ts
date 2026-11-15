import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FLYER_BUCKET, flyerActor, flyerError, imageResponse, uuidOk } from "@/lib/flyers/server";
import { preferredDjAsset } from "@/lib/flyers/dj-assets";

type Params = { params: Promise<{ djId: string }> };

/** The DJ's preferred approved name logo. 404 when there is none (the flyer then draws the DJ's name as text). */
export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  const { djId } = await params;
  if (!uuidOk(djId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const db = createAdminClient();
    const logo = await preferredDjAsset(db, djId, "name_logo");
    if (!logo) return NextResponse.json({ error: "No name logo" }, { status: 404 });
    const { data } = await db.storage.from(FLYER_BUCKET).download(logo.storage_path);
    if (!data) return NextResponse.json({ error: "No name logo" }, { status: 404 });
    return imageResponse(data, logo.mime, 120);
  } catch (err) {
    return flyerError(err);
  }
}
