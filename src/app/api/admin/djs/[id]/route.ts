import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;

  try {
    const db = createAdminClient();
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const displayName = form.get("displayName");
      const photo = form.get("photo");

      const update: Record<string, string> = {};

      if (typeof displayName === "string" && displayName.trim()) {
        update.display_name = displayName.trim();
      }

      if (photo instanceof File && photo.size > 0) {
        const ext = photo.name.split(".").pop() || "jpg";
        const path = `${id}-${Date.now()}.${ext}`;
        const buffer = Buffer.from(await photo.arrayBuffer());
        const { error: uploadError } = await db.storage
          .from("dj-photos")
          .upload(path, buffer, { contentType: photo.type, upsert: true });
        if (uploadError) throw uploadError;

        const { data: publicUrl } = db.storage.from("dj-photos").getPublicUrl(path);
        update.photo_url = publicUrl.publicUrl;
      }

      if (Object.keys(update).length === 0) {
        return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
      }

      const { data, error } = await db.from("djs").update(update).eq("id", id).select().single();
      if (error) throw error;
      return NextResponse.json({ dj: data });
    }

    const body = await req.json();
    const update: Record<string, unknown> = {};
    if (typeof body.displayName === "string" && body.displayName.trim()) {
      update.display_name = body.displayName.trim();
    }
    if (body.heroSettings && typeof body.heroSettings === "object") {
      update.hero_settings = body.heroSettings;
    }
    if (Object.keys(update).length === 0) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const { data, error } = await db.from("djs").update(update).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ dj: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  try {
    const db = createAdminClient();
    const { error } = await db.from("djs").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
