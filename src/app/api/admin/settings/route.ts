import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

const DEFAULT_SETTINGS = {
  allow_dj_self_registration: true,
  require_disclaimer_acceptance: true,
  crowd_vote_boosts_enabled: true,
  push_notifications_enabled: false,
  portal_hero_image_url: null,
  portal_hero_heading: null,
  portal_hero_subheading: null,
  admin_hero_image_url: null,
  admin_hero_heading: null,
  admin_hero_subheading: null,
  portal_hero_settings: null,
};

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const db = createAdminClient();
    const { data, error } = await db.from("platform_settings").select("*").eq("id", true).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ settings: data ?? DEFAULT_SETTINGS });
  } catch {
    // Table may not exist yet — fall back to defaults rather than break the settings page.
    return NextResponse.json({ settings: DEFAULT_SETTINGS });
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
        ...(body.portalHeroImageUrl !== undefined ? { portal_hero_image_url: body.portalHeroImageUrl } : {}),
        ...(body.portalHeroHeading !== undefined ? { portal_hero_heading: body.portalHeroHeading } : {}),
        ...(body.portalHeroSubheading !== undefined ? { portal_hero_subheading: body.portalHeroSubheading } : {}),
        ...(body.adminHeroImageUrl !== undefined ? { admin_hero_image_url: body.adminHeroImageUrl } : {}),
        ...(body.adminHeroHeading !== undefined ? { admin_hero_heading: body.adminHeroHeading } : {}),
        ...(body.adminHeroSubheading !== undefined ? { admin_hero_subheading: body.adminHeroSubheading } : {}),
        ...(body.portalHeroSettings !== undefined ? { portal_hero_settings: body.portalHeroSettings } : {})
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
