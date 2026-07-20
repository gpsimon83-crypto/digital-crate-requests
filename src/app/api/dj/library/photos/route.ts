import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

const BUCKET = "crate-builder-photos";
const VALID_SECTION = /^[a-z0-9-]+$/;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const section = req.nextUrl.searchParams.get("section");
  if (!section || !VALID_SECTION.test(section)) {
    return NextResponse.json({ error: "Invalid section" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { data, error } = await db.storage.from(BUCKET).list(section, {
      sortBy: { column: "created_at", order: "asc" },
    });
    if (error) throw error;

    const photos = (data ?? [])
      .filter((f) => f.name && !f.name.startsWith("."))
      .map((f) => {
        const path = `${section}/${f.name}`;
        const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
        return { path, url: pub.publicUrl };
      });

    return NextResponse.json({ photos });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  try {
    const form = await req.formData();
    const section = String(form.get("section") ?? "");
    const photo = form.get("photo");

    if (!VALID_SECTION.test(section)) {
      return NextResponse.json({ error: "Invalid section" }, { status: 400 });
    }
    if (!(photo instanceof File) || photo.size === 0) {
      return NextResponse.json({ error: "photo file is required" }, { status: 400 });
    }
    if (!photo.type.startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    const ext = photo.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${section}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buffer = Buffer.from(await photo.arrayBuffer());

    const db = createAdminClient();
    const { error } = await db.storage.from(BUCKET).upload(path, buffer, { contentType: photo.type });
    if (error) throw error;

    const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
    return NextResponse.json({ photo: { path, url: pub.publicUrl } });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { path } = await req.json();
  if (!path || typeof path !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { error } = await db.storage.from(BUCKET).remove([path]);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
