import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { gigRange, myGigs } from "@/lib/data/my-gigs";
import { djRowForUser } from "@/lib/view-as";

/**
 * The signed-in person's own gigs, when their login is linked to a DJ profile
 * (DJs, and staff who also DJ). Optional `?from=YYYY-MM-DD&to=YYYY-MM-DD`
 * (up to 100 days, past or future) for a calendar month; otherwise the next
 * four months.
 */
export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const db = createAdminClient();
    const dj = await djRowForUser<{ id: string; display_name: string }>(db, user.id, "id, display_name");
    if (!dj) return NextResponse.json({ dj: null, gigs: [], calendarConnected: false });
    const sp = new URL(req.url).searchParams;
    const range = gigRange(sp.get("from"), sp.get("to"));
    if ((sp.get("from") || sp.get("to")) && !range) return NextResponse.json({ error: "from and to must be dates (YYYY-MM-DD), from before to" }, { status: 400 });
    const { gigs, calendarConnected } = await myGigs(db, dj as { id: string; display_name: string }, range ?? {});
    return NextResponse.json({ dj, gigs, calendarConnected });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
