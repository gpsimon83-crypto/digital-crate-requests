import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireEventAccess } from "@/lib/require-event-access";
import { appOrigin } from "@/lib/comm/server";
import { linkForEvent, newToken, type LinkRow } from "@/lib/data/questionnaire-links";
import { basicsFor, type BasicsEvent } from "@/lib/data/basics";
import { getVisibleQuestions, isAnswered } from "@/lib/questionnaire-engine";
import { logActivity } from "@/lib/activity";

type P = { params: Promise<{ id: string }> };
const uuidOk = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const noStore = { "Cache-Control": "private, no-store" };

function nameFor(ev: BasicsEvent | null) {
  const c = Array.isArray(ev?.clients) ? ev?.clients[0] : ev?.clients;
  return [c?.first_name, c?.last_name].filter(Boolean).join(" ") || ev?.couple_display_name?.replace(/&/g, "and") || ev?.title || "";
}

/**
 * The project's Basics questionnaire link (Wedding Basics for weddings,
 * Event Basics otherwise), for staff and the project's DJ: progress, and
 * create / renew / unlock / revoke. The answers drive the package
 * recommendation.
 */
export async function GET(_req: NextRequest, { params }: P) {
  const id = (await params).id;
  if (!uuidOk(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const db = createAdminClient();
    const b = await basicsFor(db, id);
    if (!b.template) return NextResponse.json({ ready: false, kind: b.kind }, { headers: noStore });
    return NextResponse.json(view(b.kind, b.template, await linkForEvent(db, id, b.template.id)), { headers: noStore });
  } catch {
    return NextResponse.json({ ready: false }, { headers: noStore });
  }
}

function view(kind: "wedding" | "event", template: NonNullable<Awaited<ReturnType<typeof basicsFor>>["template"]>, link: LinkRow | null) {
  const flat = getVisibleQuestions(template.sections, link?.answers ?? {});
  return {
    ready: true,
    kind,
    title: template.title,
    total: flat.length,
    link: link && {
      url: `${appOrigin()}/${kind === "wedding" ? "w" : "e"}/${link.token}`,
      created_at: link.created_at,
      opened_at: link.opened_at,
      completed_at: link.completed_at,
      locked: link.locked,
      answered: flat.filter((f) => isAnswered(link.answers ?? {}, f.question.key)).length
    }
  };
}

export async function POST(req: NextRequest, { params }: P) {
  const id = (await params).id;
  if (!uuidOk(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });
  const { action } = (await req.json().catch(() => ({}))) as { action?: string };
  try {
    const db = createAdminClient();
    const b = await basicsFor(db, id);
    if (!b.template) return NextResponse.json({ error: b.kind === "event" ? "Run migration 0067_bar_packages_event_basics.sql in Supabase first." : "Run migration 0054_questionnaire_links.sql first." }, { status: 503 });
    const current = await linkForEvent(db, id, b.template.id);
    const now = new Date().toISOString();
    if (action === "create" || action === "renew") {
      if (current && action === "create") return NextResponse.json(view(b.kind, b.template, current));
      if (current) await db.from("questionnaire_links").update({ revoked_at: now }).eq("id", current.id);
      const { data, error } = await db
        .from("questionnaire_links")
        .insert({ token: newToken(nameFor(b.event)), event_id: id, template_id: b.template.id, created_by: access.user.id, answers: current?.answers ?? {}, completed_at: current?.completed_at ?? null, locked: current?.locked ?? false, applied: current?.applied ?? null })
        .select("*")
        .single();
      if (error) throw error;
      await logActivity({ actorUserId: access.user.id, action: "questionnaire.link_created", entityType: "event", entityId: id, eventId: id, metadata: { questionnaire: b.template.title, by: access.isAdmin ? "staff" : "dj" } }).catch(() => {});
      return NextResponse.json(view(b.kind, b.template, data as LinkRow));
    }
    if (!current) return NextResponse.json({ error: "There's no link yet." }, { status: 404 });
    if (action === "unlock") {
      const { data, error } = await db.from("questionnaire_links").update({ locked: false, updated_at: now }).eq("id", current.id).select("*").single();
      if (error) throw error;
      return NextResponse.json(view(b.kind, b.template, data as LinkRow));
    }
    if (action === "revoke") {
      await db.from("questionnaire_links").update({ revoked_at: now }).eq("id", current.id);
      return NextResponse.json(view(b.kind, b.template, null));
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Couldn't update the link right now." }, { status: 503 });
  }
}
