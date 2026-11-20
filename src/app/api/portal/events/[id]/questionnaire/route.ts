import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createClient } from "@/lib/supabase/server";
import { getClientForAuthUser, getClientEvent } from "@/lib/data/portal";
import { requirePortalReadAccess } from "@/lib/require-portal-access";
import { getTemplateForEventType, getResponse, upsertResponse } from "@/lib/data/questionnaires";
import type { Answers, Template } from "@/lib/questionnaire-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { linkForEvent, weddingBasicsTemplate } from "@/lib/data/questionnaire-links";

/** Planning "Sound & setup" answers that Wedding Basics already covers, for keys not answered yet. */
async function setupPrefill(eventId: string, template: Template, answers: Answers): Promise<Answers> {
  const keys = new Set(template.sections.flatMap((s) => s.questions.map((q) => q.key)));
  if (!keys.has("setup_setting") && !keys.has("setup_ceremony_space")) return {};
  try {
    const wb = await weddingBasicsTemplate();
    const basics = wb ? (await linkForEvent(createAdminClient(), eventId, wb.id))?.answers : null;
    if (!basics) return {};
    const val = (k: string) => {
      const v = basics[k];
      return v && !("unsure" in v) ? v.value : undefined;
    };
    const coverage = Array.isArray(val("coverage")) ? (val("coverage") as string[]) : null;
    const out: Answers = {};
    const set = (k: string, v: string | undefined) => {
      if (v && keys.has(k) && !answers[k]) out[k] = { value: v };
    };
    const setting = val("indoor_outdoor");
    set("setup_setting", typeof setting === "string" && setting !== "unsure" ? setting : undefined);
    const ceremony = val("ceremony_location");
    set("setup_ceremony_space", coverage && !coverage.includes("ceremony") ? "none" : typeof ceremony === "string" && ceremony !== "unsure" ? ceremony : undefined);
    set("setup_cocktail_space", coverage && !coverage.includes("cocktail") ? "none" : undefined);
    return out;
  } catch {
    return {};
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requirePortalReadAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const event = access.event;

    if (!event.event_category) return NextResponse.json({ template: null, response: null });

    const template = await getTemplateForEventType(event.event_category);
    if (!template) return NextResponse.json({ template: null, response: null });

    const response = await getResponse(id);
    // Sound & setup answers they already gave in Wedding Basics come pre-filled (not saved until they save).
    const prefill = await setupPrefill(id, template, (response?.answers as Answers | undefined) ?? {});
    if (!Object.keys(prefill).length) return NextResponse.json({ template, response });
    return NextResponse.json({
      template,
      response: response ? { ...response, answers: { ...prefill, ...response.answers } } : { answers: prefill, current_question_key: null, completed_at: null }
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const { answers, currentQuestionKey } = body as { answers?: Answers; currentQuestionKey?: string | null };

  try {
    const client = await getClientForAuthUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record linked to this account" }, { status: 403 });

    const event = await getClientEvent(client.id, id);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    if (!event.event_category) return NextResponse.json({ error: "No questionnaire available for this event type" }, { status: 404 });

    const template = await getTemplateForEventType(event.event_category);
    if (!template) return NextResponse.json({ error: "No questionnaire available for this event type" }, { status: 404 });

    const response = await upsertResponse(id, template.id, { answers, currentQuestionKey });
    return NextResponse.json({ response });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
