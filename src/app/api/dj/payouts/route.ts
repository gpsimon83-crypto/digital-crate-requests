import { NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { listPayoutsForDj } from "@/lib/data/payouts";

// Scoped by DJ-profile linkage, not a role check — same pattern as
// /api/dj/profile and /api/dj/email-account. A staff account that's also
// linked to a real djs row (e.g. an owner who DJs their own events) needs
// this to work too, and resolveUserRole() would otherwise pick "admin"
// over "dj" and block it, same bug already fixed on the profile page.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const db = createAdminClient();
  const { data: dj } = await db.from("djs").select("id").eq("auth_user_id", user.id).maybeSingle();
  if (!dj) return NextResponse.json({ error: "Your login isn't linked to a DJ profile." }, { status: 403 });

  try {
    const payouts = await listPayoutsForDj(dj.id);
    return NextResponse.json({ payouts });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
