import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { applyWeddingBasics, linkForEvent, weddingBasicsTemplate, type LinkRow } from "@/lib/data/questionnaire-links";
import { displayAnswer, getVisibleQuestions, isAnswered, type Template } from "@/lib/questionnaire-engine";
import { getTemplateDetail, priceTemplate, saveSelection } from "@/lib/data/package-builder";
import { addOnsFor, fitPackage, needsFromAnswers, type AddOn } from "@/lib/wedding-recommend";
import { logActivity } from "@/lib/activity";

type P = { params: Promise<{ id: string }> };
const uuidOk = (v: string) => /^[0-9a-f-]{36}$/i.test(v);
const noStore = { "Cache-Control": "private, no-store" };

export type RecommendedPackage = {
  templateId: string;
  name: string;
  tier: string | null;
  best: boolean;
  totalCents: number | null;
  requiresQuote: boolean;
  why: string[];
  watch: string[];
  notOffered: AddOn[];
};

async function recommend(link: LinkRow, djId: string | null, eventDate: string | null) {
  const needs = needsFromAnswers(link.answers ?? {});
  const { addOns, notes } = addOnsFor(needs);
  const scored: { score: number; pkg: RecommendedPackage }[] = [];
  let packagesError: string | null = null;
  try {
    const db = createAdminClient();
    const { data } = await db.from("package_templates").select("id").eq("status", "published").or("event_type.eq.wedding,event_type.is.null").order("position");
    for (const row of (data ?? []) as { id: string }[]) {
      const detail = await getTemplateDetail(row.id, djId);
      if (!detail) continue;
      const fit = fitPackage(detail.template, detail.sections, needs, addOns);
      const price = await priceTemplate(
        row.id,
        Object.entries(fit.selections).map(([lineItemId, quantity]) => ({ lineItemId, quantity })),
        { eventDate, guestCount: needs.guests, travelMiles: null, hoursBooked: needs.hoursNeeded },
        undefined,
        djId
      );
      scored.push({ score: fit.score, pkg: { templateId: fit.templateId, name: fit.name, tier: fit.tier, best: false, totalCents: price?.totalCents ?? null, requiresQuote: !!price?.requiresQuote, why: fit.why, watch: fit.watch, notOffered: fit.notOffered } });
    }
  } catch {
    packagesError = "Packages couldn't be loaded.";
  }
  // Best fit first; between equal fits, the lower price.
  scored.sort((a, b) => b.score - a.score || (a.pkg.totalCents ?? Infinity) - (b.pkg.totalCents ?? Infinity));
  const packages = scored.slice(0, 3).map((x, i) => ({ ...x.pkg, best: i === 0 }));
  return { needs, addOns, notes, packages, packagesError };
}

async function view(template: Template, link: LinkRow | null, djId: string | null, eventDate: string | null) {
  if (!link) return { ready: true, templateId: template.id, link: null, recommendations: null };
  const flat = getVisibleQuestions(template.sections, link.answers ?? {});
  const answered = flat.filter((f) => isAnswered(link.answers ?? {}, f.question.key)).length;
  return {
    ready: true,
    templateId: template.id,
    total: flat.length,
    link: {
      created_at: link.created_at,
      opened_at: link.opened_at,
      completed_at: link.completed_at,
      locked: link.locked,
      answered,
      applied: link.applied,
      answers: flat.map(({ section, question }) => ({ section: section.title, prompt: question.prompt, answer: isAnswered(link.answers ?? {}, question.key) ? displayAnswer(question, link.answers[question.key]) : null }))
    },
    recommendations: answered ? await recommend(link, djId, eventDate) : null
  };
}

/** Staff or the event's DJ: Wedding Basics answers, what was filled in, and package recommendations. */
export async function GET(_req: NextRequest, { params }: P) {
  const id = (await params).id;
  if (!uuidOk(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });
  try {
    const template = await weddingBasicsTemplate();
    if (!template) return NextResponse.json({ ready: false }, { headers: noStore });
    const db = createAdminClient();
    const { data: ev } = await db.from("events").select("starts_at").eq("id", id).maybeSingle();
    const link = await linkForEvent(db, id, template.id);
    return NextResponse.json(await view(template, link, access.event.dj_id, (ev as { starts_at: string | null } | null)?.starts_at?.slice(0, 10) ?? null), { headers: noStore });
  } catch {
    return NextResponse.json({ ready: false }, { headers: noStore });
  }
}

/**
 * "use": use their answer for a field the CRM already had a different value
 * for. "send": put a recommended package (with the extras) in the client's
 * portal as a draft for them to review — same place "Use this package" puts it.
 */
export async function POST(req: NextRequest, { params }: P) {
  const id = (await params).id;
  if (!uuidOk(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });
  const body = (await req.json().catch(() => ({}))) as { action?: string; field?: string; templateId?: string };
  const db = createAdminClient();
  try {
    const template = await weddingBasicsTemplate();
    if (!template) return NextResponse.json({ error: "Wedding Basics isn't set up yet." }, { status: 503 });
    const link = await linkForEvent(db, id, template.id);
    if (!link?.completed_at) return NextResponse.json({ error: "They haven't submitted their answers yet." }, { status: 409 });
    const { data: ev } = await db.from("events").select("starts_at").eq("id", id).maybeSingle();
    const eventDate = (ev as { starts_at: string | null } | null)?.starts_at?.slice(0, 10) ?? null;

    if (body.action === "use") {
      const field = String(body.field ?? "");
      if (!link.applied?.differs.some((d) => d.field === field)) return NextResponse.json({ error: "Nothing to update for that field." }, { status: 400 });
      const result = await applyWeddingBasics(db, id, link.answers ?? {}, { overwrite: [field], template });
      const applied = { filled: [...new Set([...(link.applied?.filled ?? []), ...result.filled])], differs: result.differs };
      await db.from("questionnaire_links").update({ applied, updated_at: new Date().toISOString() }).eq("id", link.id);
      await logActivity({ actorUserId: access.user.id, action: "questionnaire.answer_used", entityType: "event", entityId: id, eventId: id, metadata: { field } });
      return NextResponse.json(await view(template, { ...link, applied }, access.event.dj_id, eventDate));
    }

    if (body.action === "send") {
      const templateId = String(body.templateId ?? "");
      const detail = uuidOk(templateId) ? await getTemplateDetail(templateId, access.event.dj_id) : null;
      if (!detail || detail.template.status !== "published") return NextResponse.json({ error: "Package not found." }, { status: 404 });
      const needs = needsFromAnswers(link.answers ?? {});
      const fit = fitPackage(detail.template, detail.sections, needs, addOnsFor(needs).addOns);
      const sel = Object.entries(fit.selections).map(([lineItemId, quantity]) => ({ lineItemId, quantity }));
      const price = await priceTemplate(templateId, sel, { eventDate, guestCount: needs.guests, travelMiles: null, hoursBooked: needs.hoursNeeded }, undefined, access.event.dj_id);
      if (!price) return NextResponse.json({ error: "Package not found." }, { status: 404 });
      const selection = await saveSelection(id, { packageTemplateId: templateId, packageTemplateVersion: detail.template.version, status: "draft", selections: fit.selections, appliedDealIds: [], priceSnapshot: price });
      await logActivity({ actorUserId: access.user.id, action: "package.recommended", entityType: "event", entityId: id, eventId: id, metadata: { package: detail.template.name } });
      return NextResponse.json({ ok: true, selection, name: detail.template.name });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Couldn't do that right now." }, { status: 503 });
  }
}
