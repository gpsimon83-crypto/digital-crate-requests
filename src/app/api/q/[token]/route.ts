import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { cleanAnswers, linkByToken, weddingBasicsTemplate } from "@/lib/data/questionnaire-links";
import { getTemplateForEventType } from "@/lib/data/questionnaires";

type P = { params: Promise<{ token: string }> };
const noStore = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
const gone = () => NextResponse.json({ error: "This questionnaire link isn't active anymore. Ask Digital Crate DJs for a new one." }, { status: 404, headers: noStore });

async function templateFor(db: ReturnType<typeof createAdminClient>, templateId: string) {
  const { data } = await db.from("questionnaire_templates").select("event_type").eq("id", templateId).maybeSingle();
  const type = (data as { event_type: string } | null)?.event_type;
  return type ? await getTemplateForEventType(type) : await weddingBasicsTemplate();
}

/** Private link (no login): the questionnaire and what's been answered so far. */
export async function GET(_req: NextRequest, { params }: P) {
  const db = createAdminClient();
  try {
    const link = await linkByToken(db, (await params).token);
    if (!link) return gone();
    const template = await templateFor(db, link.template_id);
    if (!template) return gone();
    if (!link.opened_at) await db.from("questionnaire_links").update({ opened_at: new Date().toISOString() }).eq("id", link.id);
    const { data: ev } = await db.from("events").select("couple_display_name").eq("id", link.event_id).maybeSingle();
    return NextResponse.json(
      {
        template,
        response: { answers: link.answers ?? {}, current_question_key: link.current_question_key, completed_at: link.completed_at },
        locked: link.locked,
        couple: (ev as { couple_display_name: string | null } | null)?.couple_display_name ?? null
      },
      { headers: noStore }
    );
  } catch {
    return NextResponse.json({ error: "Couldn't load the questionnaire. Please try again in a minute." }, { status: 503, headers: noStore });
  }
}

/** Saves answers as they're given. Nothing changes once it's been submitted (locked). */
export async function PATCH(req: NextRequest, { params }: P) {
  const db = createAdminClient();
  try {
    const link = await linkByToken(db, (await params).token);
    if (!link) return gone();
    if (link.locked) return NextResponse.json({ error: "Your answers are already in. Contact us if something needs to change." }, { status: 409, headers: noStore });
    const template = await templateFor(db, link.template_id);
    if (!template) return gone();
    const body = (await req.json().catch(() => ({}))) as { answers?: unknown; currentQuestionKey?: unknown };
    const answers = { ...(link.answers ?? {}), ...cleanAnswers(template, body.answers) };
    const update: Record<string, unknown> = { answers, updated_at: new Date().toISOString() };
    if (body.currentQuestionKey === null || (typeof body.currentQuestionKey === "string" && body.currentQuestionKey.length <= 80)) update.current_question_key = body.currentQuestionKey;
    const { error } = await db.from("questionnaire_links").update(update).eq("id", link.id);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch {
    return NextResponse.json({ error: "Couldn't save. Please try again." }, { status: 503, headers: noStore });
  }
}
