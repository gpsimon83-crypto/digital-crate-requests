import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchOwnStorageImage, flyerActor, flyerError, imageResponse, uuidOk } from "@/lib/flyers/server";

type Params = { params: Promise<{ venueId: string }> };

/** A venue's logo (already public marketing art), served same-origin for the canvas. */
export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  const { venueId } = await params;
  if (!uuidOk(venueId)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const { data } = await createAdminClient().from("venues").select("logo_url").eq("id", venueId).maybeSingle();
    const res = await fetchOwnStorageImage((data as { logo_url: string | null } | null)?.logo_url);
    if (!res) return NextResponse.json({ error: "No logo" }, { status: 404 });
    return imageResponse(await res.arrayBuffer(), res.headers.get("content-type") ?? "image/png", 600);
  } catch (err) {
    return flyerError(err);
  }
}
