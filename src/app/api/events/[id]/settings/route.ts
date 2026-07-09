import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireAuth } from "@/lib/require-auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { id } = await params;

  try {
    const db = createAdminClient();
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const photo = form.get("heroPhoto");
      const clearHero = form.get("clearHero");

      const update: Record<string, string | null> = {};

      if (photo instanceof File && photo.size > 0) {
        const ext = photo.name.split(".").pop() || "jpg";
        const path = `${id}-${Date.now()}.${ext}`;
        const buffer = Buffer.from(await photo.arrayBuffer());
        const { error: uploadError } = await db.storage
          .from("event-photos")
          .upload(path, buffer, { contentType: photo.type, upsert: true });
        if (uploadError) throw uploadError;

        const { data: publicUrl } = db.storage.from("event-photos").getPublicUrl(path);
        update.hero_image_url = publicUrl.publicUrl;
      } else if (clearHero === "true") {
        update.hero_image_url = null;
      }

      if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      }

      const { data, error } = await db.from("events").update(update).eq("id", id).select().single();
      if (error) throw error;
      return NextResponse.json({ event: data });
    }

    const body = await req.json();
    const { mustPlay, doNotPlay, guestRequestSettings } = body;

    const update: Record<string, unknown> = {};
    if (mustPlay !== undefined) update.must_play = mustPlay;
    if (doNotPlay !== undefined) update.do_not_play = doNotPlay;
    if (guestRequestSettings !== undefined) update.guest_request_settings = guestRequestSettings;

    const { data, error } = await db.from("events").update(update).eq("id", id).select().single();
    if (error) throw error;

    return NextResponse.json({ event: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
