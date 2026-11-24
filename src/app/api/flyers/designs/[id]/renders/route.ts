import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkSceneSources, flyerActor, uuidOk } from "@/lib/flyers/server";
import { parseAnimation } from "@/lib/flyers/motion/schema";
import { FORMATS, type FormatKey, type Scene } from "@/lib/flyers/types";
import { MAX_ACTIVE_PER_USER, type RenderJob } from "@/lib/flyers/render-jobs";
import { downloadUrl, jobsError, publicJob, sweepJobs } from "@/lib/flyers/render-jobs-server";

type Params = { params: Promise<{ id: string }> };
type Row = { id: string; dj_id: string; title: string; scene: Scene; dj_slots?: (string | null)[] | null; animation?: unknown };

/** The flyer, if this person may export it (its DJ, or staff). */
async function design(actor: Exclude<Awaited<ReturnType<typeof flyerActor>>, NextResponse>, id: string) {
  if (!uuidOk(id)) return null;
  const { data, error } = await createAdminClient().from("flyer_designs").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  const row = data as Row | null;
  if (!row || (!actor.staff && row.dj_id !== actor.dj?.id)) return null;
  return row;
}

const fileName = (title: string, j: RenderJob) => `${title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-") || "flyer"}-${j.width}x${j.height}-${Number(j.duration)}s.mp4`;

/** This flyer's video exports, newest first (with download links for finished ones). */
export async function GET(_req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const row = await design(actor, (await params).id);
    if (!row) return NextResponse.json({ error: "Flyer not found" }, { status: 404 });
    const db = createAdminClient();
    await sweepJobs(db, { designId: row.id });
    const { data, error } = await db.from("flyer_render_jobs").select("*").eq("design_id", row.id).order("created_at", { ascending: false }).limit(20);
    if (error) throw error;
    const jobs = await Promise.all(((data ?? []) as RenderJob[]).map(async (j) => ({ ...publicJob(j), downloadUrl: await downloadUrl(db, j, fileName(row.title, j)) })));
    return NextResponse.json({ jobs });
  } catch (e) {
    return jobsError(e);
  }
}

/** Queue a video export. The browser that asks does the rendering and reports back. */
export async function POST(req: NextRequest, { params }: Params) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  try {
    const row = await design(actor, (await params).id);
    if (!row) return NextResponse.json({ error: "Flyer not found" }, { status: 404 });
    const b = (await req.json().catch(() => ({}))) as { format?: unknown };
    const format = (typeof b.format === "string" && b.format in FORMATS ? b.format : null) as FormatKey | null;
    if (!format) return NextResponse.json({ error: "Pick Story, Portrait or Square." }, { status: 400 });
    const a = parseAnimation(row.animation ?? null);
    if (!a.ok) return NextResponse.json({ error: `The motion settings can't be read: ${a.error}` }, { status: 400 });
    if (!a.value) return NextResponse.json({ error: "Add some motion first (and let it save), then export." }, { status: 400 });
    // Check the pictures before any rendering starts (only the flyer's own images; no outside links).
    const db = createAdminClient();
    const bad = await checkSceneSources(db, row.scene, row.dj_id, (row.dj_slots ?? []).filter((x): x is string => !!x));
    if (bad) return NextResponse.json({ error: bad }, { status: 400 });

    await sweepJobs(db, { createdBy: actor.user.id });
    const { count, error: cErr } = await db.from("flyer_render_jobs").select("id", { count: "exact", head: true }).eq("created_by", actor.user.id).in("status", ["queued", "rendering", "encoding"]);
    if (cErr) throw cErr;
    if ((count ?? 0) >= MAX_ACTIVE_PER_USER) return NextResponse.json({ error: `You already have ${MAX_ACTIVE_PER_USER} videos exporting. Wait for one to finish (or cancel it).` }, { status: 429 });

    const f = FORMATS[format];
    const { data, error } = await db
      .from("flyer_render_jobs")
      .insert({ design_id: row.id, dj_id: row.dj_id, created_by: actor.user.id, format, width: f.width, height: f.height, duration: a.value.duration, fps: a.value.fps })
      .select("*")
      .single();
    if (error) throw error;
    return NextResponse.json({ job: publicJob(data as RenderJob) });
  } catch (e) {
    return jobsError(e);
  }
}
