import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { audit, requireVenueAdmin, sniffImage } from "@/lib/venue/server";

const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Venue cover photo or logo. The file's real bytes must be JPG, PNG or
 * WebP (the browser's claimed type isn't trusted). Stored in the existing
 * public event-photos bucket under venues/<id>/.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  try {
    const form = await req.formData();
    const kind = form.get("kind");
    if (kind !== "cover" && kind !== "logo") return NextResponse.json({ error: "Unknown image type." }, { status: 400 });
    const file = form.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
    if (file.size > MAX_BYTES) return NextResponse.json({ error: "Images must be 8 MB or smaller." }, { status: 400 });
    const buf = new Uint8Array(await file.arrayBuffer());
    const type = sniffImage(buf);
    if (!type) return NextResponse.json({ error: "Use a JPG, PNG or WebP image." }, { status: 400 });

    const db = createAdminClient();
    const { data: venue } = await db.from("venues").select("id").eq("id", id).maybeSingle();
    if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });

    const path = `venues/${id}/${kind}-${crypto.randomUUID()}.${type.ext}`;
    const { error } = await db.storage.from("event-photos").upload(path, buf, { contentType: type.mime, upsert: false });
    if (error) throw error;
    const url = db.storage.from("event-photos").getPublicUrl(path).data.publicUrl;
    const column = kind === "cover" ? "cover_url" : "logo_url";
    const { error: upErr } = await db.from("venues").update({ [column]: url, updated_at: new Date().toISOString() }).eq("id", id);
    if (upErr) throw upErr;
    await audit(id, admin, `venue.${kind}_uploaded`, { path });
    return NextResponse.json({ url });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
