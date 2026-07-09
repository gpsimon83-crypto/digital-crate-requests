import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function getOwnDjId() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = createAdminClient();
  const { data } = await db.from("djs").select("id").eq("auth_user_id", user.id).maybeSingle();
  return data?.id ?? null;
}

export async function GET() {
  const djId = await getOwnDjId();
  if (!djId) return NextResponse.json({ error: "Not signed in as a DJ" }, { status: 401 });

  try {
    const db = createAdminClient();
    const { data, error } = await db.from("djs").select("*").eq("id", djId).single();
    if (error) throw error;
    return NextResponse.json({ dj: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  const djId = await getOwnDjId();
  if (!djId) return NextResponse.json({ error: "Not signed in as a DJ" }, { status: 401 });

  try {
    const db = createAdminClient();
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const photo = form.get("photo");
      const update: Record<string, string> = {};

      if (photo instanceof File && photo.size > 0) {
        const ext = photo.name.split(".").pop() || "jpg";
        const path = `${djId}-${Date.now()}.${ext}`;
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

      const { data, error } = await db.from("djs").update(update).eq("id", djId).select().single();
      if (error) throw error;
      return NextResponse.json({ dj: data });
    }

    const body = await req.json();
    if (!body.heroSettings || typeof body.heroSettings !== "object") {
      return NextResponse.json({ error: "heroSettings is required" }, { status: 400 });
    }

    const { data, error } = await db
      .from("djs")
      .update({ hero_settings: body.heroSettings })
      .eq("id", djId)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ dj: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
