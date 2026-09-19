import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createClient } from "@/lib/supabase/server";
import { getClientForAuthUser, getClientEvent } from "@/lib/data/portal";
import { requirePortalReadAccess } from "@/lib/require-portal-access";
import { getTemplateForEventType, getResponse, upsertResponse } from "@/lib/data/questionnaires";
import type { Answers } from "@/lib/questionnaire-engine";

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
    return NextResponse.json({ template, response });
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
