import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaffUser, appOrigin } from "@/lib/comm/server";
import { linkForEvent, newToken, weddingBasicsTemplate, type LinkRow } from "@/lib/data/questionnaire-links";
import { getVisibleQuestions, isAnswered, displayAnswer } from "@/lib/questionnaire-engine";
import { logActivity } from "@/lib/activity";

type P = { params: Promise<{ id: string }> };
const uuidOk = (v: string) => /^[0-9a-f-]{36}$/i.test(v);

async function view(link: LinkRow | null) {
  const template = await weddingBasicsTemplate();
  if (!template) return { ready: false };
  if (!link) return { ready: true, templateId: template.id, link: null, total: getVisibleQuestions(template.sections, {}).length };
  const flat = getVisibleQuestions(template.sections, link.answers ?? {});
  return {
    ready: true,
    templateId: template.id,
    total: flat.length,
    link: {
      url: `${appOrigin()}/q/${link.token}`,
      created_at: link.created_at,
      opened_at: link.opened_at,
      completed_at: link.completed_at,
      locked: link.locked,
      answered: flat.filter((f) => isAnswered(link.answers ?? {}, f.question.key)).length,
      applied: link.applied,
      answers: flat.map(({ section, question }) => ({ section: section.title, prompt: question.prompt, answer: isAnswered(link.answers ?? {}, question.key) ? displayAnswer(question, link.answers[question.key]) : null }))
    }
  };
}

/** Staff: the event's Wedding basics link, its progress and answers. */
export async function GET(_req: NextRequest, { params }: P) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const id = (await params).id;
  if (!uuidOk(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const template = await weddingBasicsTemplate();
    if (!template) return NextResponse.json({ ready: false });
    return NextResponse.json(await view(await linkForEvent(createAdminClient(), id, template.id)));
  } catch {
    // Before migration 0054 there's no link table or Wedding basics questionnaire yet.
    return NextResponse.json({ ready: false });
  }
}

/**
 * Staff actions: "create" (or "renew": a new link, the old one stops
 * working; answers so far carry over), "unlock" (let them edit after
 * submitting), "revoke" (link stops working).
 */
export async function POST(req: NextRequest, { params }: P) {
  const staff = await requireStaffUser();
  if (staff instanceof NextResponse) return staff;
  const id = (await params).id;
  if (!uuidOk(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  const db = createAdminClient();
  try {
    const template = await weddingBasicsTemplate();
    if (!template) return NextResponse.json({ error: "Run migration 0054_questionnaire_links.sql in Supabase first." }, { status: 503 });
    const { data: ev } = await db.from("events").select("id").eq("id", id).maybeSingle();
    if (!ev) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    const current = await linkForEvent(db, id, template.id);
    const now = new Date().toISOString();
    if (action === "create" || action === "renew") {
      if (current && action === "create") return NextResponse.json(await view(current));
      if (current) await db.from("questionnaire_links").update({ revoked_at: now }).eq("id", current.id);
      const { data, error } = await db
        .from("questionnaire_links")
        .insert({ token: newToken(), event_id: id, template_id: template.id, created_by: staff.userId, answers: current?.answers ?? {}, completed_at: current?.completed_at ?? null, locked: current?.locked ?? false, applied: current?.applied ?? null })
        .select("*")
        .single();
      if (error) throw error;
      await logActivity({ actorUserId: staff.userId, action: "questionnaire.link_created", entityType: "event", entityId: id, eventId: id, metadata: { questionnaire: template.title } });
      return NextResponse.json(await view(data as LinkRow));
    }
    if (!current) return NextResponse.json({ error: "There's no link yet." }, { status: 404 });
    if (action === "unlock") {
      const { data, error } = await db.from("questionnaire_links").update({ locked: false, updated_at: now }).eq("id", current.id).select("*").single();
      if (error) throw error;
      return NextResponse.json(await view(data as LinkRow));
    }
    if (action === "revoke") {
      await db.from("questionnaire_links").update({ revoked_at: now }).eq("id", current.id);
      return NextResponse.json(await view(null));
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Couldn't update the link. Has migration 0054_questionnaire_links.sql been run?" }, { status: 503 });
  }
}
