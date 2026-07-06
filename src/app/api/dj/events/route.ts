import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createEvent } from "@/lib/data/events";
import { errorMessage } from "@/lib/error-message";

/**
 * DJs create their own events directly (auto-confirmed, since there's no
 * one else who needs to approve a DJ booking themselves). Admin-created
 * events still go through the pending_confirmation flow.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { title, venueId, startsAt, endsAt } = await req.json();
  if (!title || !startsAt) {
    return NextResponse.json({ error: "title and startsAt are required" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { data: dj } = await db.from("djs").select("id").eq("auth_user_id", user.id).maybeSingle();

    if (!dj) {
      return NextResponse.json({ error: "Your login isn't linked to a DJ profile." }, { status: 403 });
    }

    const event = await createEvent({
      title,
      djId: dj.id,
      venueId,
      startsAt,
      endsAt,
      status: "confirmed",
    });

    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
