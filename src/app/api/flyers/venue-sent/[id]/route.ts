import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerActor, flyerError, uuidOk } from "@/lib/flyers/server";

/** Take a sent flyer off the venue's portal (staff, or the DJ whose flyer it is). The image is kept for the record. */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  const id = (await params).id;
  if (!uuidOk(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const db = createAdminClient();
    const { data } = await db.from("venue_flyers").select("id, design_id").eq("id", id).maybeSingle();
    const row = data as { id: string; design_id: string | null } | null;
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (!actor.staff) {
      const { data: d } = row.design_id ? await db.from("flyer_designs").select("dj_id").eq("id", row.design_id).maybeSingle() : { data: null };
      if ((d as { dj_id: string } | null)?.dj_id !== actor.dj?.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const { error } = await db.from("venue_flyers").update({ hidden: true }).eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return flyerError(err);
  }
}
