import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyWeddingBasics, cleanAnswers, linkByToken, submissionProblems, WEDDING_BASICS } from "@/lib/data/questionnaire-links";
import { getTemplateForEventType } from "@/lib/data/questionnaires";
import { logActivity } from "@/lib/activity";
import { applyEventBasics, EVENT_BASICS } from "@/lib/data/basics";

const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };

/**
 * Submit: every required answer must be there and well formed. Then the
 * answers are locked, and empty event / client fields are filled from them.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const db = createAdminClient();
  try {
    const link = await linkByToken(db, (await params).token);
    if (!link) return NextResponse.json({ error: "This questionnaire link isn't active anymore." }, { status: 404, headers: noStore });
    if (link.locked) return NextResponse.json({ ok: true, completed_at: link.completed_at }, { headers: noStore });
    const { data: t } = await db.from("questionnaire_templates").select("event_type").eq("id", link.template_id).maybeSingle();
    const type = (t as { event_type: string } | null)?.event_type ?? WEDDING_BASICS;
    const template = await getTemplateForEventType(type);
    if (!template) return NextResponse.json({ error: "This questionnaire isn't available." }, { status: 404, headers: noStore });

    const body = (await req.json().catch(() => ({}))) as { answers?: unknown };
    const answers = { ...(link.answers ?? {}), ...cleanAnswers(template, body.answers) };
    const problems = submissionProblems(template, answers);
    if (problems.length) return NextResponse.json({ error: `${problems[0].prompt} ${problems[0].problem}`, problems }, { status: 400, headers: noStore });

    const now = new Date().toISOString();
    const applied = type === WEDDING_BASICS ? await applyWeddingBasics(db, link.event_id, answers, { template }) : type === EVENT_BASICS ? await applyEventBasics(db, link.event_id, answers) : { filled: [], differs: [] };
    const { error } = await db.from("questionnaire_links").update({ answers, completed_at: now, locked: true, current_question_key: null, applied, updated_at: now }).eq("id", link.id);
    if (error) throw error;
    await logActivity({ actorLabel: "Client (questionnaire link)", action: "questionnaire.completed", entityType: "event", entityId: link.event_id, eventId: link.event_id, metadata: { questionnaire: template.title, filled: applied.filled, differs: applied.differs.map((d) => d.field) } });
    return NextResponse.json({ ok: true, completed_at: now }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Couldn't submit right now. Your answers are saved — please try again in a minute." }, { status: 503, headers: noStore });
  }
}
