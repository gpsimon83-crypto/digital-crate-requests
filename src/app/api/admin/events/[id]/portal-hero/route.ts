import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireAdmin } from "@/lib/require-admin";

/**
 * Admin-only "Customize Portal" hero — deliberately a separate field
 * (events.portal_hero_image_url) and a separate route from
 * /api/events/[id]/settings, which already owns events.hero_image_url
 * for the public guest-request-page hero (a different audience/moment,
 * DJ-editable). Keeping them apart means this can stay admin-only
 * without touching that existing DJ self-service feature at all.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;

  try {
    const db = createAdminClient();
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const photo = form.get("portalHeroPhoto");
      const clearHero = form.get("clearPortalHero");

      const update: Record<string, string | null> = {};

      if (photo instanceof File && photo.size > 0) {
        const ext = photo.name.split(".").pop() || "jpg";
        const path = `portal-${id}-${Date.now()}.${ext}`;
        const buffer = Buffer.from(await photo.arrayBuffer());
        const { error: uploadError } = await db.storage.from("event-photos").upload(path, buffer, { contentType: photo.type, upsert: true });
        if (uploadError) throw uploadError;

        const { data: publicUrl } = db.storage.from("event-photos").getPublicUrl(path);
        update.portal_hero_image_url = publicUrl.publicUrl;
      } else if (clearHero === "true") {
        update.portal_hero_image_url = null;
      }

      if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      }

      const { data, error } = await db.from("events").update(update).eq("id", id).select().single();
      if (error) throw error;
      return NextResponse.json({ event: data });
    }

    const body = await req.json();
    const { portalHeroSettings, coupleDisplayName, portalHeroHeadlineOverride, portalHeroSubheadingOverride, timezone } = body;

    const update: Record<string, unknown> = {};
    if (portalHeroSettings !== undefined) update.portal_hero_settings = portalHeroSettings;
    if (coupleDisplayName !== undefined) update.couple_display_name = coupleDisplayName;
    if (portalHeroHeadlineOverride !== undefined) update.portal_hero_headline_override = portalHeroHeadlineOverride;
    if (portalHeroSubheadingOverride !== undefined) update.portal_hero_subheading_override = portalHeroSubheadingOverride;
    if (timezone !== undefined) update.timezone = timezone;

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await db.from("events").update(update).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ event: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
