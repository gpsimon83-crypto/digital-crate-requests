import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerActor } from "@/lib/flyers/server";
import { VIDEO_BUCKET, videoPath } from "@/lib/flyers/render-jobs";
import { jobsError, loadJob } from "@/lib/flyers/render-jobs-server";

type Params = { params: Promise<{ jobId: string }> };

/** A one-time upload link for the finished MP4 (straight to private storage; the file never passes through this server). */
export async function POST(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const db = createAdminClient();
    const j = await loadJob(db, actor, (await params).jobId);
    if (j instanceof NextResponse) return j;
    if (j.created_by !== actor.user.id) return NextResponse.json({ error: "Only the person exporting this video can upload it." }, { status: 403 });
    if (j.status !== "encoding") return NextResponse.json({ error: j.status === "cancelled" ? "This export was cancelled." : `This video job is ${j.status}.`, cancelled: j.status === "cancelled" }, { status: 409 });
    const { data, error } = await db.storage.from(VIDEO_BUCKET).createSignedUploadUrl(videoPath(j), { upsert: true });
    if (error || !data) throw error ?? new Error("Couldn't get an upload link.");
    return NextResponse.json({ url: data.signedUrl });
  } catch (e) {
    return jobsError(e);
  }
}
