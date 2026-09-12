import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

/**
 * Read-only hero-banner fields from platform_settings — safe for any
 * signed-in user (portal client, DJ, or staff), unlike the full
 * /api/admin/settings route which is staff-only and carries other
 * platform toggles.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("platform_settings")
      .select("portal_hero_image_url, portal_hero_heading, portal_hero_subheading, admin_hero_image_url, admin_hero_heading, admin_hero_subheading")
      .eq("id", true)
      .maybeSingle();
    if (error) throw error;

    return NextResponse.json({
      portalHero: { imageUrl: data?.portal_hero_image_url ?? null, heading: data?.portal_hero_heading ?? null, subheading: data?.portal_hero_subheading ?? null },
      adminHero: { imageUrl: data?.admin_hero_image_url ?? null, heading: data?.admin_hero_heading ?? null, subheading: data?.admin_hero_subheading ?? null }
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
