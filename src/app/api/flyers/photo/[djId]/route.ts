import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOwnStorageImage, flyerActor, flyerError, imageResponse, uuidOk } from "@/lib/flyers/server";

type Params = { params: Promise<{ djId: string }> };

/** The DJ's saved profile photo, served same-origin for the canvas. Only that DJ and staff. */
export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  const { djId } = await params;
  if (!uuidOk(djId) || (!actor.staff && actor.dj?.id !== djId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const { data } = await createAdminClient().from("djs").select("photo_url").eq("id", djId).maybeSingle();
    const res = await fetchOwnStorageImage((data as { photo_url: string | null } | null)?.photo_url);
    if (!res) return NextResponse.json({ error: "No photo" }, { status: 404 });
    return imageResponse(await res.arrayBuffer(), res.headers.get("content-type") ?? "image/jpeg", 120);
  } catch (err) {
    return flyerError(err);
  }
}
