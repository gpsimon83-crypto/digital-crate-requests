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

    // Dashboard banner extras (migration 0063). Optional: without them the dashboard uses its built-in photos.
    // Default banner for client project pages (migration 0066). Optional.
    const cover = await db.from("platform_settings").select("default_project_cover").eq("id", true).maybeSingle();
    const projectCover = !cover.error ? ((cover.data?.default_project_cover as string | null) ?? null) : null;

    let adminDashboard: { weddingFocal: { x: number; y: number } | null; clubUrl: string | null; clubFocal: { x: number; y: number } | null } | null = null;
    const extra = await db.from("platform_settings").select("admin_club_image_url, admin_dashboard_banners").eq("id", true).maybeSingle();
    if (!extra.error && extra.data) {
      const b = (extra.data.admin_dashboard_banners ?? {}) as Record<string, { xPosition?: number; yPosition?: number } | undefined>;
      const f = (v?: { xPosition?: number; yPosition?: number }) =>
        v && Number.isFinite(v.xPosition) && Number.isFinite(v.yPosition) ? { x: Math.min(100, Math.max(0, Number(v.xPosition))), y: Math.min(100, Math.max(0, Number(v.yPosition))) } : null;
      adminDashboard = { weddingFocal: f(b.wedding), clubUrl: extra.data.admin_club_image_url ?? null, clubFocal: f(b.club) };
    }

    return NextResponse.json({
      adminDashboard,
      portalHero: { projectCover, imageUrl: data?.portal_hero_image_url ?? null, heading: data?.portal_hero_heading ?? null, subheading: data?.portal_hero_subheading ?? null },
      adminHero: { imageUrl: data?.admin_hero_image_url ?? null, heading: data?.admin_hero_heading ?? null, subheading: data?.admin_hero_subheading ?? null }
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
