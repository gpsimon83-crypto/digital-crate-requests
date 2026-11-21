import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { myGigs } from "@/lib/data/my-gigs";

/** The signed-in person's own gigs, when their login is linked to a DJ profile (DJs, and staff who also DJ). */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const db = createAdminClient();
    const { data: dj } = await db.from("djs").select("id, display_name").eq("auth_user_id", user.id).maybeSingle();
    if (!dj) return NextResponse.json({ dj: null, gigs: [], calendarConnected: false });
    const { gigs, calendarConnected } = await myGigs(db, dj as { id: string; display_name: string });
    return NextResponse.json({ dj, gigs, calendarConnected });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
