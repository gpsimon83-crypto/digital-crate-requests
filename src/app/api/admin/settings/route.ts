import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const db = createAdminClient();
    const { data, error } = await db.from("platform_settings").select("*").eq("id", true).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("platform_settings")
      .update({
        allow_dj_self_registration: body.allowDjSelfRegistration,
        require_disclaimer_acceptance: body.requireDisclaimerAcceptance,
        crowd_vote_boosts_enabled: body.crowdVoteBoostsEnabled,
        push_notifications_enabled: body.pushNotificationsEnabled,
      })
      .eq("id", true)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ settings: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
