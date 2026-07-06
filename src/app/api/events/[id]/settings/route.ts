import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { mustPlay, doNotPlay, guestRequestSettings } = body;

  try {
    const db = createAdminClient();
    const update: Record<string, unknown> = {};
    if (mustPlay !== undefined) update.must_play = mustPlay;
    if (doNotPlay !== undefined) update.do_not_play = doNotPlay;
    if (guestRequestSettings !== undefined) update.guest_request_settings = guestRequestSettings;

    const { data, error } = await db.from("events").update(update).eq("id", id).select().single();
    if (error) throw error;

    return NextResponse.json({ event: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
