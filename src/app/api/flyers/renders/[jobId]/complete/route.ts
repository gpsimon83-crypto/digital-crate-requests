import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerActor } from "@/lib/flyers/server";
import { MAX_VIDEO_BYTES, VIDEO_BUCKET, videoPath } from "@/lib/flyers/render-jobs";
import { downloadUrl, jobsError, loadJob, publicJob } from "@/lib/flyers/render-jobs-server";

type Params = { params: Promise<{ jobId: string }> };

/** The upload finished: check the file really is there (and a sensible size), then mark the job completed. */
export async function POST(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const db = createAdminClient();
    const j = await loadJob(db, actor, (await params).jobId);
    if (j instanceof NextResponse) return j;
    if (j.created_by !== actor.user.id) return NextResponse.json({ error: "Only the person exporting this video can finish it." }, { status: 403 });
    if (j.status !== "encoding") return NextResponse.json({ error: `This video job is ${j.status}.`, cancelled: j.status === "cancelled" }, { status: 409 });
    const path = videoPath(j);
    const { data: info, error: iErr } = await db.storage.from(VIDEO_BUCKET).info(path);
    const size = Number((info as { size?: number } | null)?.size ?? 0);
    if (iErr || !size) return NextResponse.json({ error: "The video didn't arrive in storage. Try again." }, { status: 400 });
    if (size > MAX_VIDEO_BYTES) {
      await db.storage.from(VIDEO_BUCKET).remove([path]);
      return NextResponse.json({ error: "That video is too large to keep." }, { status: 400 });
    }
    const now = new Date().toISOString();
    const { data, error } = await db.from("flyer_render_jobs").update({ status: "completed", progress: 1, storage_path: path, bytes: size, heartbeat_at: now, updated_at: now, finished_at: now, error: null }).eq("id", j.id).eq("status", "encoding").select("*").maybeSingle();
    if (error) throw error;
    if (!data) {
      await db.storage.from(VIDEO_BUCKET).remove([path]);
      return NextResponse.json({ error: "This export was cancelled.", cancelled: true }, { status: 409 });
    }
    return NextResponse.json({ job: publicJob(data), downloadUrl: await downloadUrl(db, data, `flyer-${j.width}x${j.height}-${Number(j.duration)}s.mp4`) });
  } catch (e) {
    return jobsError(e);
  }
}
