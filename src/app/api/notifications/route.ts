import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createClient } from "@/lib/supabase/server";
import { listNotificationsForUser } from "@/lib/data/notifications";
import { createAdminClient } from "@/lib/supabase/admin";
import { viewAsDjIdFor } from "@/lib/view-as";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    // View as DJ: that DJ's own notifications, not yours.
    const db = createAdminClient();
    const viewing = await viewAsDjIdFor(db, user.id);
    let uid = user.id;
    if (viewing) {
      const { data } = await db.from("djs").select("auth_user_id").eq("id", viewing).maybeSingle();
      uid = (data?.auth_user_id as string | null) ?? "";
    }
    const notifications = uid ? await listNotificationsForUser(uid) : [];
    return NextResponse.json({ notifications });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
