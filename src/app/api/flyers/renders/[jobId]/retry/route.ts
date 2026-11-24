import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerActor } from "@/lib/flyers/server";
import { MAX_ATTEMPTS, MAX_ACTIVE_PER_USER, canRetry } from "@/lib/flyers/render-jobs";
import { jobsError, loadJob, publicJob } from "@/lib/flyers/render-jobs-server";

type Params = { params: Promise<{ jobId: string }> };

/** Try a failed or cancelled export again (at most 3 tries in all). */
export async function POST(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const db = createAdminClient();
    const j = await loadJob(db, actor, (await params).jobId);
    if (j instanceof NextResponse) return j;
    if (!canRetry(j)) return NextResponse.json({ error: j.attempts >= MAX_ATTEMPTS ? `Tried ${MAX_ATTEMPTS} times already: start a new export instead.` : `This video job is ${j.status}.` }, { status: 409 });
    const { count } = await db.from("flyer_render_jobs").select("id", { count: "exact", head: true }).eq("created_by", actor.user.id).in("status", ["queued", "rendering", "encoding"]);
    if ((count ?? 0) >= MAX_ACTIVE_PER_USER) return NextResponse.json({ error: `You already have ${MAX_ACTIVE_PER_USER} videos exporting.` }, { status: 429 });
    const now = new Date().toISOString();
    const { data, error } = await db.from("flyer_render_jobs").update({ status: "queued", progress: 0, error: null, attempts: j.attempts + 1, created_by: actor.user.id, heartbeat_at: now, updated_at: now, finished_at: null }).eq("id", j.id).select("*").single();
    if (error) throw error;
    return NextResponse.json({ job: publicJob(data) });
  } catch (e) {
    return jobsError(e);
  }
}
