import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireVenueAccess } from "@/lib/venue/server";

/** Flyers Digital Crate DJs sent to this venue, newest first. */
export async function GET(req: NextRequest) {
  const access = await requireVenueAccess(req.nextUrl.searchParams.get("venue"));
  if (access instanceof NextResponse) return access;
  const db = createAdminClient();
  const { data, error } = await db
    .from("venue_flyers")
    .select("id, title, night_date, note, width, height, sent_at")
    .eq("venue_id", access.venue.id)
    .eq("hidden", false)
    .order("sent_at", { ascending: false })
    .limit(60);
  // Before migration 0053 there's simply nothing to show.
  return NextResponse.json({ flyers: error ? [] : (data ?? []) });
}
