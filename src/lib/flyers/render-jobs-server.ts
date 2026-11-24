import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { setupMissing, uuidOk, type FlyerActor } from "./server";
import { KEEP_DAYS, STALE_MS, VIDEO_BUCKET, canSeeJob, type RenderJob } from "./render-jobs";

type Db = ReturnType<typeof createAdminClient>;

export const JOBS_SETUP = "Video export jobs need migration 0070_flyer_render_jobs.sql in Supabase.";

export function jobsError(err: unknown) {
  if (setupMissing(err)) return NextResponse.json({ error: JOBS_SETUP, setup: true }, { status: 503 });
  const msg = err instanceof Error ? err.message : (err as { message?: string })?.message;
  return NextResponse.json({ error: msg || "Something went wrong with the video job." }, { status: 503 });
}

export const who = (a: FlyerActor) => ({ staff: a.staff, userId: a.user.id, djId: a.dj?.id ?? null });

/** A job this person may see, or a 404 (never "forbidden": other people's jobs don't exist for them). */
export async function loadJob(db: Db, actor: FlyerActor, id: string): Promise<RenderJob | NextResponse> {
  if (!uuidOk(id)) return NextResponse.json({ error: "Video job not found" }, { status: 404 });
  const { data, error } = await db.from("flyer_render_jobs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  const j = data as RenderJob | null;
  if (!j || !canSeeJob(j, who(actor))) return NextResponse.json({ error: "Video job not found" }, { status: 404 });
  return j;
}

/**
 * Housekeeping, run whenever jobs are listed or created: active jobs whose
 * browser went quiet are marked failed (so nothing stays "rendering"
 * forever), and finished videos older than 30 days are deleted.
 */
export async function sweepJobs(db: Db, filter: { createdBy?: string; designId?: string }) {
  const now = new Date();
  let stale = db
    .from("flyer_render_jobs")
    .update({ status: "failed", error: "The browser doing this export stopped responding (the tab was closed or went to sleep). Try again and keep the tab open.", updated_at: now.toISOString(), finished_at: now.toISOString() })
    .in("status", ["queued", "rendering", "encoding"])
    .lt("heartbeat_at", new Date(now.getTime() - STALE_MS).toISOString());
  if (filter.createdBy) stale = stale.eq("created_by", filter.createdBy);
  if (filter.designId) stale = stale.eq("design_id", filter.designId);
  const { error } = await stale;
  if (error) throw error;

  let old = db.from("flyer_render_jobs").select("id, storage_path").not("storage_path", "is", null).lt("finished_at", new Date(now.getTime() - KEEP_DAYS * 86400_000).toISOString()).limit(50);
  if (filter.designId) old = old.eq("design_id", filter.designId);
  const { data } = await old;
  const rows = (data ?? []) as { id: string; storage_path: string }[];
  if (rows.length) {
    await db.storage.from(VIDEO_BUCKET).remove(rows.map((r) => r.storage_path));
    await db.from("flyer_render_jobs").update({ storage_path: null, bytes: null, error: "Removed after 30 days." }).in("id", rows.map((r) => r.id));
  }
}

/** A short-lived download link for a finished video (never a public URL). */
export async function downloadUrl(db: Db, j: RenderJob, filename: string) {
  if (j.status !== "completed" || !j.storage_path) return null;
  const { data } = await db.storage.from(VIDEO_BUCKET).createSignedUrl(j.storage_path, 600, { download: filename });
  return data?.signedUrl ?? null;
}

export function publicJob(j: RenderJob) {
  return { id: j.id, designId: j.design_id, format: j.format, width: j.width, height: j.height, duration: Number(j.duration), fps: j.fps, status: j.status, progress: Number(j.progress), error: j.error, attempts: j.attempts, codec: j.codec, bytes: j.bytes, createdAt: j.created_at, finishedAt: j.finished_at };
}
