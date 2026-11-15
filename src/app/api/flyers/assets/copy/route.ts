import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanFolder, FLYER_BUCKET, flyerAdmin, flyerError, publicAsset, uuidOk } from "@/lib/flyers/server";
import { MAX_DJ_UPLOADS } from "@/lib/flyers/image-check";

const DJ_KINDS = ["photo", "image", "cutout", "name_logo"];
type Source = { id: string; scope: string; kind: string; name: string | null; storage_path: string; mime: string; bytes: number | null; width: number; height: number; has_alpha: boolean };

/**
 * Staff: put images that are already uploaded (template art, or another
 * DJ's library) into a DJ's library, without uploading them again. Each
 * one is copied, so deleting either copy later never affects the other.
 * Copies added by staff count as approved.
 */
export async function POST(req: NextRequest) {
  const admin = await flyerAdmin();
  if (admin instanceof NextResponse) return admin;
  const b = (await req.json().catch(() => ({}))) as { sourceIds?: unknown; djId?: unknown; kind?: unknown; folder?: unknown };
  const ids = Array.isArray(b.sourceIds) ? [...new Set(b.sourceIds.filter((x): x is string => uuidOk(x)))] : [];
  if (!ids.length) return NextResponse.json({ error: "Choose at least one image." }, { status: 400 });
  if (ids.length > 50) return NextResponse.json({ error: "Add up to 50 images at a time." }, { status: 400 });
  if (!uuidOk(b.djId)) return NextResponse.json({ error: "Choose which DJ's library to add them to." }, { status: 400 });
  const kind = typeof b.kind === "string" && DJ_KINDS.includes(b.kind) ? b.kind : null;
  const folder = cleanFolder(b.folder);
  try {
    const db = createAdminClient();
    const { data: dj } = await db.from("djs").select("id").eq("id", b.djId).maybeSingle();
    if (!dj) return NextResponse.json({ error: "DJ not found." }, { status: 404 });
    const { count, error: cErr } = await db.from("flyer_assets").select("id", { count: "exact", head: true }).eq("owner_dj_id", b.djId);
    if (cErr) throw cErr;
    const room = MAX_DJ_UPLOADS - (count ?? 0);
    if (room < ids.length) return NextResponse.json({ error: room > 0 ? `This DJ's library has room for ${room} more image${room === 1 ? "" : "s"}.` : "This DJ's library is full. Delete some images first." }, { status: 400 });

    const { data: rows, error: sErr } = await db.from("flyer_assets").select("*").in("id", ids);
    if (sErr) throw sErr;
    const sources = ids.map((id) => ((rows ?? []) as Source[]).find((r) => r.id === id)).filter((r): r is Source => !!r);
    if (sources.length !== ids.length) return NextResponse.json({ error: "Some of those images no longer exist." }, { status: 404 });

    const added: Record<string, unknown>[] = [];
    for (const s of sources) {
      const { data: file, error: dErr } = await db.storage.from(FLYER_BUCKET).download(s.storage_path);
      if (dErr || !file) return NextResponse.json({ error: `“${s.name ?? "An image"}” is missing its file.`, added: added.map(publicAsset) }, { status: 404 });
      const ext = s.storage_path.split(".").pop() || "png";
      const path = `dj/${b.djId}/${randomUUID()}.${ext}`;
      const buf = new Uint8Array(await file.arrayBuffer());
      const { error: upErr } = await db.storage.from(FLYER_BUCKET).upload(path, buf, { contentType: s.mime, upsert: false });
      if (upErr) throw upErr;
      const newKind = kind ?? (DJ_KINDS.includes(s.kind) ? s.kind : "image");
      const { data, error } = await db
        .from("flyer_assets")
        .insert({
          scope: "dj",
          kind: newKind,
          owner_dj_id: b.djId,
          name: s.name,
          storage_path: path,
          mime: s.mime,
          bytes: s.bytes ?? buf.length,
          width: s.width,
          height: s.height,
          has_alpha: s.has_alpha,
          created_by: admin.user.id,
          ...(folder ? { folder } : {}),
          ...(newKind === "cutout" || newKind === "name_logo" ? { approved: true } : {})
        })
        .select("*")
        .single();
      if (error) {
        await db.storage.from(FLYER_BUCKET).remove([path]);
        throw error;
      }
      added.push(data as Record<string, unknown>);
    }
    return NextResponse.json({ ok: true, assets: added.map(publicAsset) });
  } catch (err) {
    return flyerError(err);
  }
}
