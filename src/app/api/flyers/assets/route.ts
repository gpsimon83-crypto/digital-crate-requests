import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanFolder, FLYER_BUCKET, flyerActor, flyerError, publicAsset, publicAssets, uuidOk } from "@/lib/flyers/server";
import { checkUpload, MAX_DJ_UPLOADS } from "@/lib/flyers/image-check";

const KINDS = ["background", "overlay", "logo", "photo", "image"] as const;

/** The library: staff list template art; a DJ lists their own uploads (staff may pass ?dj=). */
export async function GET(req: NextRequest) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  const scope = req.nextUrl.searchParams.get("scope") === "template" ? "template" : "dj";
  try {
    const db = createAdminClient();
    let q = db.from("flyer_assets").select("*").eq("scope", scope).order("created_at", { ascending: false }).limit(1000);
    if (scope === "template") {
      if (!actor.staff) return NextResponse.json({ error: "Only staff manage template art." }, { status: 403 });
    } else {
      const dj = req.nextUrl.searchParams.get("dj") || actor.dj?.id || "";
      if (dj !== actor.dj?.id && !(actor.staff && uuidOk(dj))) return NextResponse.json({ error: "You can only see your own uploads." }, { status: 403 });
      if (!uuidOk(dj)) return NextResponse.json({ assets: [] });
      q = q.eq("owner_dj_id", dj);
    }
    const { data, error } = await q;
    if (error) throw error;
    const rows = (data ?? []) as Record<string, unknown>[];
    return NextResponse.json({ assets: publicAssets(rows), foldersReady: !rows.length || "folder" in rows[0] });
  } catch (err) {
    return flyerError(err);
  }
}

/**
 * Upload an image. DJs upload to their own private library (photos and
 * images); staff can also add shared template assets. The original file is
 * stored untouched: cropping and flipping happen only in the flyer's layers.
 */
export async function POST(req: NextRequest) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
    const scope = form?.get("scope") === "template" ? "template" : "dj";
    const kindRaw = String(form?.get("kind") ?? "image");
    const kind = (KINDS as readonly string[]).includes(kindRaw) ? kindRaw : "image";
    const folder = cleanFolder(form?.get("folder"));
    const name = String(form?.get("name") ?? file.name ?? "").replace(/[^\w .()-]+/g, "").trim().slice(0, 120) || null;

    // Size check before reading everything into memory.
    if (file.size > 16 * 1024 * 1024) return NextResponse.json({ error: "Images can be up to 15 MB." }, { status: 413 });

    const db = createAdminClient();
    let ownerDjId: string | null = null;
    if (scope === "template") {
      if (!actor.staff) return NextResponse.json({ error: "Only staff can add template assets." }, { status: 403 });
    } else {
      const forDj = String(form?.get("djId") ?? "") || actor.dj?.id || "";
      if (forDj !== actor.dj?.id && !(actor.staff && uuidOk(forDj))) return NextResponse.json({ error: "You can only upload to your own library." }, { status: 403 });
      if (!uuidOk(forDj)) return NextResponse.json({ error: "Choose which DJ this photo is for." }, { status: 400 });
      ownerDjId = forDj;
      const { count, error: cErr } = await db.from("flyer_assets").select("id", { count: "exact", head: true }).eq("owner_dj_id", ownerDjId);
      if (cErr) throw cErr;
      if ((count ?? 0) >= MAX_DJ_UPLOADS) return NextResponse.json({ error: `You have ${MAX_DJ_UPLOADS} uploads. Delete some before adding more.` }, { status: 400 });
    }

    const buf = new Uint8Array(await file.arrayBuffer());
    const check = checkUpload(buf, scope);
    if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
    const { info } = check;

    const path = `${scope === "template" ? "template" : `dj/${ownerDjId}`}/${randomUUID()}.${info.ext}`;
    const { error: upErr } = await db.storage.from(FLYER_BUCKET).upload(path, buf, { contentType: info.mime, upsert: false });
    if (upErr) throw upErr;
    const { data, error } = await db
      .from("flyer_assets")
      .insert({ scope, kind: scope === "dj" && kind !== "photo" ? "image" : kind, owner_dj_id: ownerDjId, name, storage_path: path, mime: info.mime, bytes: buf.length, width: info.width, height: info.height, has_alpha: info.hasAlpha, created_by: actor.user.id, ...(folder ? { folder } : {}) })
      .select("*")
      .single();
    if (error) {
      await db.storage.from(FLYER_BUCKET).remove([path]);
      throw error;
    }
    return NextResponse.json({ asset: publicAsset(data) });
  } catch (err) {
    return flyerError(err);
  }
}
