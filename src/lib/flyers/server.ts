import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { staffSessionMeetsMfa } from "@/lib/security/mfa";
import { accountRole, isStaffRole } from "@/lib/roles";
import { SAMPLE_TEMPLATE_SLUG, sampleTemplateContent } from "./sample-template";
import type { Scene } from "./types";

export const FLYER_BUCKET = "flyer-assets";
type Db = ReturnType<typeof createAdminClient>;

export type FlyerActor = {
  user: User;
  /** Staff whose session passed two-factor (when required). */
  staff: boolean;
  dj: { id: string; display_name: string; photo_url: string | null } | null;
};

/** Who is using the Flyer Creator: a DJ (their own flyers) and/or staff (everything). Venue logins are refused. */
export async function flyerActor(): Promise<FlyerActor | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  if (user.app_metadata?.role === "venue") return NextResponse.json({ error: "Not available for venue logins" }, { status: 403 });
  const staff = isStaffRole(accountRole(user)) && (await staffSessionMeetsMfa(supabase));
  const db = createAdminClient();
  const { data: dj } = await db.from("djs").select("id, display_name, photo_url").eq("auth_user_id", user.id).maybeSingle();
  if (!staff && !dj) return NextResponse.json({ error: "The Flyer Creator is for DJs and staff." }, { status: 403 });
  return { user, staff, dj: (dj as FlyerActor["dj"]) ?? null };
}

export async function flyerAdmin(): Promise<FlyerActor | NextResponse> {
  const a = await flyerActor();
  if (a instanceof NextResponse) return a;
  if (!a.staff) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  return a;
}

/** Postgres "table/column missing" codes: the migration hasn't been run yet. */
export function setupMissing(err: unknown): boolean {
  const e = err as { code?: string; message?: string } | null;
  return !!e && (e.code === "42P01" || e.code === "PGRST205" || e.code === "42703" || /does not exist|schema cache/i.test(e.message ?? ""));
}

export function flyerError(err: unknown, fallback = "Something went wrong.") {
  if (setupMissing(err)) {
    return NextResponse.json({ error: "The Flyer Creator isn't set up yet: run migration 0050_flyer_creator.sql in Supabase.", setup: true }, { status: 503 });
  }
  const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
  return NextResponse.json({ error: msg || fallback }, { status: 503 });
}

export const uuidOk = (s: unknown): s is string => typeof s === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/**
 * Every image a scene points at must be one this DJ may use: a template
 * asset, the DJ's own upload, the DJ's own profile photo, or a venue logo.
 */
export async function checkSceneSources(db: Db, scene: Scene, djId: string): Promise<string | null> {
  const assetIds = new Set<string>();
  for (const n of scene.nodes) {
    if (n.kind !== "image") continue;
    if (n.source.type === "asset") assetIds.add(n.source.assetId);
    if (n.source.type === "dj_photo" && n.source.djId && n.source.djId !== djId) return "A flyer can only use this DJ's own photo.";
  }
  if (!assetIds.size) return null;
  const { data, error } = await db.from("flyer_assets").select("id, scope, owner_dj_id").in("id", [...assetIds]);
  if (error) throw error;
  const rows = (data ?? []) as { id: string; scope: string; owner_dj_id: string | null }[];
  for (const id of assetIds) {
    const r = rows.find((x) => x.id === id);
    if (!r) return "One of the images no longer exists. Replace it and try again.";
    if (r.scope === "dj" && r.owner_dj_id !== djId) return "That image belongs to someone else.";
  }
  return null;
}

/** Puts the built-in sample template in place (published, version 1) the first time it's needed. */
export async function ensureSampleTemplate(db: Db, userId: string | null): Promise<void> {
  const { data: existing, error } = await db.from("flyer_templates").select("id").eq("slug", SAMPLE_TEMPLATE_SLUG).maybeSingle();
  if (error) throw error;
  if (existing) return;
  const content = sampleTemplateContent();
  const { data: t, error: tErr } = await db
    .from("flyer_templates")
    .insert({ slug: SAMPLE_TEMPLATE_SLUG, name: "Club Night (sample)", description: "Club lights, gold halo portrait, live text for every booking detail.", status: "published", draft: content, created_by: userId })
    .select("id")
    .single();
  if (tErr) {
    if ((tErr as { code?: string }).code === "23505") return; // someone else just made it
    throw tErr;
  }
  const { data: v, error: vErr } = await db.from("flyer_template_versions").insert({ template_id: t.id, version: 1, content, published_by: userId }).select("id").single();
  if (vErr) throw vErr;
  await db.from("flyer_templates").update({ current_version_id: v.id }).eq("id", t.id);
}

/** Fetches an image from this project's own Supabase storage (never an arbitrary URL) for same-origin serving. */
export async function fetchOwnStorageImage(url: string | null | undefined): Promise<Response | null> {
  if (!url) return null;
  let u: URL;
  let base: URL;
  try {
    u = new URL(url);
    base = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || u.host !== base.host || !u.pathname.startsWith("/storage/v1/object/public/")) return null;
  const res = await fetch(u, { cache: "no-store" });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !/^image\/(png|jpeg|webp|gif)$/.test(type.split(";")[0].trim())) return null;
  return res;
}

export function imageResponse(body: BodyInit, type: string, maxAge = 300) {
  return new NextResponse(body, {
    headers: {
      "Content-Type": type,
      "Cache-Control": `private, max-age=${maxAge}`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox"
    }
  });
}

/**
 * An image as the browser sees it. Selected with "*" so the folder column is
 * picked up when migration 0051 has run and simply absent before.
 */
export type PublicAsset = { id: string; kind: string; name: string | null; folder: string | null; width: number; height: number; has_alpha: boolean; bytes: number | null; created_at: string };
export function publicAsset(r: Record<string, unknown>): PublicAsset {
  return {
    id: r.id as string,
    kind: r.kind as string,
    name: (r.name as string) ?? null,
    folder: (r.folder as string) ?? null,
    width: r.width as number,
    height: r.height as number,
    has_alpha: !!r.has_alpha,
    bytes: (r.bytes as number) ?? null,
    created_at: r.created_at as string
  };
}
export const publicAssets = (rows: unknown) => ((rows ?? []) as Record<string, unknown>[]).map(publicAsset);

/**
 * Where an image is used: DJ flyers, template drafts and published template
 * versions (published ones are what DJs start from).
 */
export async function assetUsage(db: Db, assetId: string) {
  const ref = { nodes: [{ source: { assetId } }] };
  const { count: designs } = await db.from("flyer_designs").select("id", { count: "exact", head: true }).contains("scene", ref);
  const names = new Set<string>();
  let published = 0;
  for (const f of ["square", "portrait", "story"]) {
    const { data: t } = await db.from("flyer_templates").select("id, name").contains("draft", { formats: { [f]: ref } });
    for (const r of (t ?? []) as { name: string }[]) names.add(r.name);
    const { count } = await db.from("flyer_template_versions").select("id", { count: "exact", head: true }).contains("content", { formats: { [f]: ref } });
    published += count ?? 0;
  }
  return { designs: designs ?? 0, templates: [...names], publishedVersions: published };
}

/** Folder names: trimmed, up to 60 characters, no slashes (folders don't nest). */
export function cleanFolder(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const f = v.replace(/[\/\\<>]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
  return f || null;
}

