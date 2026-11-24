import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerActor } from "@/lib/flyers/server";
import { VIDEO_BUCKET, canMove, cleanError, fromStates, isActive, isStale, type JobState } from "@/lib/flyers/render-jobs";
import { downloadUrl, jobsError, loadJob, publicJob } from "@/lib/flyers/render-jobs-server";

type Params = { params: Promise<{ jobId: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const db = createAdminClient();
    const j = await loadJob(db, actor, (await params).jobId);
    if (j instanceof NextResponse) return j;
    return NextResponse.json({ job: { ...publicJob(j), stale: isStale(j) }, downloadUrl: await downloadUrl(db, j, `flyer-${j.width}x${j.height}-${Number(j.duration)}s.mp4`) });
  } catch (e) {
    return jobsError(e);
  }
}

/**
 * Progress from the browser doing the work (also its heartbeat). The reply
 * says whether the job was cancelled meanwhile (from any device), so the
 * browser can stop its encoder.
 */
export async function PATCH(req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const db = createAdminClient();
    const j = await loadJob(db, actor, (await params).jobId);
    if (j instanceof NextResponse) return j;
    if (j.created_by !== actor.user.id) return NextResponse.json({ error: "Only the person exporting this video can report its progress." }, { status: 403 });
    if (j.status === "cancelled") return NextResponse.json({ job: publicJob(j), cancelled: true });
    const b = (await req.json().catch(() => ({}))) as { status?: unknown; progress?: unknown; error?: unknown; codec?: unknown };
    const to = (typeof b.status === "string" ? b.status : j.status) as JobState;
    if (to === "completed") return NextResponse.json({ error: "Finish the upload first." }, { status: 400 });
    if (!canMove(j.status, to)) return NextResponse.json({ error: `This video job is already ${j.status}.`, job: publicJob(j) }, { status: 409 });
    const now = new Date().toISOString();
    const update: Record<string, unknown> = { status: to, heartbeat_at: now, updated_at: now };
    if (typeof b.progress === "number" && Number.isFinite(b.progress)) update.progress = Math.min(1, Math.max(0, b.progress));
    if (typeof b.codec === "string") update.codec = b.codec.slice(0, 40);
    if (to === "failed") {
      update.error = cleanError(b.error);
      update.finished_at = now;
    }
    // Applies only while the job is still in a state this report can follow (reports may overlap).
    const { data, error } = await db.from("flyer_render_jobs").update(update).eq("id", j.id).in("status", fromStates(to)).select("*").maybeSingle();
    if (error) throw error;
    if (!data) {
      // It moved on meanwhile: cancelled (stop the encoder) or already finished.
      const { data: now2 } = await db.from("flyer_render_jobs").select("status").eq("id", j.id).maybeSingle();
      return NextResponse.json({ cancelled: !now2 || (now2 as { status: JobState }).status === "cancelled" || (now2 as { status: JobState }).status === "failed" });
    }
    return NextResponse.json({ job: publicJob(data), cancelled: false });
  } catch (e) {
    return jobsError(e);
  }
}

/** Cancel an active job (its browser stops at its next report), or delete a finished one and its file. */
export async function DELETE(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const db = createAdminClient();
    const j = await loadJob(db, actor, (await params).jobId);
    if (j instanceof NextResponse) return j;
    const now = new Date().toISOString();
    if (isActive(j.status)) {
      const { error } = await db.from("flyer_render_jobs").update({ status: "cancelled", updated_at: now, finished_at: now }).eq("id", j.id);
      if (error) throw error;
      return NextResponse.json({ cancelled: true });
    }
    if (j.storage_path) await db.storage.from(VIDEO_BUCKET).remove([j.storage_path]);
    const { error } = await db.from("flyer_render_jobs").delete().eq("id", j.id);
    if (error) throw error;
    return NextResponse.json({ deleted: true });
  } catch (e) {
    return jobsError(e);
  }
}
