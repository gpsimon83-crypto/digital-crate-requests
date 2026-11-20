import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadFacts, syncPlaybook, type TaskRecord } from "@/lib/data/playbook";
import { ISSUE_KEY, snapshot, templateByKey, type Owner } from "@/lib/playbook";
import { logActivity } from "@/lib/activity";
import { errorMessage } from "@/lib/error-message";

type P = { params: Promise<{ id: string; taskId: string }> };
const OWNERS: Owner[] = ["staff", "booking_lead", "dj", "client"];
const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/**
 * Task actions. Staff can act on any task except the client's own; the
 * assigned DJ can act on DJ tasks and manual tasks. Objective tasks
 * complete from their records, not by hand. Outreach sends are claimed
 * first and logged after, so a draft can't go out twice.
 */
export async function PATCH(req: NextRequest, { params }: P) {
  const { id, taskId } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  const db = createAdminClient();
  const { data: row } = await db.from("tasks").select("*").eq("id", taskId).eq("event_id", id).maybeSingle();
  const task = row as TaskRecord | null;
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const staff = access.isAdmin;
  const owner = task.owner ?? null;
  const canAct = staff ? owner !== "client" : owner === "dj" || owner === null;
  if (!canAct) return NextResponse.json({ error: owner === "booking_lead" ? "Booking staff handle this request." : "This one isn't yours to change." }, { status: 403 });

  const tpl = templateByKey(task.template_key);
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { updated_at: now };
  const action = typeof body.action === "string" ? body.action : null;

  try {
    // Old checklist API (manual tasks): title / dueDate / completed.
    if (body.title !== undefined) patch.title = text(body.title, 200) || task.title;
    if (body.dueDate !== undefined) {
      patch.due_date = body.dueDate ? String(body.dueDate).slice(0, 10) : null;
      if (tpl) patch.due_overridden = true; // a hand-set date is never recalculated
    }
    if (body.completed !== undefined && !tpl) Object.assign(patch, body.completed ? { status: "done", completed_at: now, completed_by: access.user.id } : { status: "open", completed_at: null });
    if (body.checklist && typeof body.checklist === "object") {
      const allowed = new Set(tpl?.readyWhen ?? []);
      patch.checklist = Object.fromEntries(Object.entries(body.checklist as Record<string, unknown>).filter(([k]) => allowed.has(k)).map(([k, v]) => [k, v === true]));
    }

    if (action === "ready") {
      if (tpl?.kind === "objective") return NextResponse.json({ error: "This one completes itself when the record is in." }, { status: 400 });
      if (tpl?.kind === "recap") return NextResponse.json({ error: "Submit the recap form." }, { status: 400 });
      if (tpl?.kind === "outreach" && !tpl.optional && !task.sent_at) return NextResponse.json({ error: "Send it first (or log it as sent)." }, { status: 400 });
      if (task.template_key?.startsWith("request:") && !staff) return NextResponse.json({ error: "Booking staff handle this request." }, { status: 403 });
      const facts = tpl?.watch?.length ? await loadFacts(db, id) : null;
      Object.assign(patch, {
        status: "done",
        completed_at: now,
        completed_by: access.user.id,
        waiting_reason: null,
        waiting_on: null,
        review_note: null,
        reviewed_snapshot: facts && tpl?.watch ? snapshot(facts, tpl.watch) : null,
        data: { ...task.data, ...(tpl?.kind === "outreach" && !task.sent_at ? { skipped: true } : {}), ...(typeof body.resolution === "string" ? { resolution: text(body.resolution, 1000) } : {}) }
      });
    } else if (action === "waiting") {
      const reason = text(body.reason, 300);
      if (!reason) return NextResponse.json({ error: "Say what's missing." }, { status: 400 });
      const on = OWNERS.includes(body.waitingOn as Owner) ? (body.waitingOn as Owner) : "staff";
      Object.assign(patch, { status: "waiting", waiting_reason: reason, waiting_on: on });
    } else if (action === "reopen") {
      Object.assign(patch, { status: "open", completed_at: null, waiting_reason: null, waiting_on: null });
    } else if (action === "recap") {
      if (tpl?.kind !== "recap") return NextResponse.json({ error: "Not a recap." }, { status: 400 });
      const r = body.recap as Record<string, unknown> | undefined;
      const recap = { worked: text(r?.worked, 1000), improvement: text(r?.improvement, 1000), issue: text(r?.issue, 1000), personal: text(r?.personal, 500) };
      if (!recap.worked || !recap.improvement || !recap.personal) return NextResponse.json({ error: "Fill in what worked, one improvement and one personal detail." }, { status: 400 });
      Object.assign(patch, { status: "done", completed_at: now, completed_by: access.user.id, data: { ...task.data, ...recap, submittedAt: now } });
      if (recap.issue) {
        // One issue task per event; it holds the review and referral outreach until resolved.
        const { error } = await db.from("tasks").insert({ event_id: id, template_key: ISSUE_KEY, stage: 8, owner: "staff", title: "Resolve the issue from the wedding", status: "open", data: { details: recap.issue } });
        if (error && (error as { code?: string }).code !== "23505") throw error;
        if (error) await db.from("tasks").update({ status: "open", completed_at: null, data: { details: recap.issue }, updated_at: now }).eq("event_id", id).eq("template_key", ISSUE_KEY);
      }
    } else if (action === "claim_send" || action === "log_sent" || action === "release_send") {
      if (!staff || tpl?.kind !== "outreach") return NextResponse.json({ error: "Only booking staff send outreach." }, { status: 403 });
      if (action === "claim_send") {
        if (task.sent_at) return NextResponse.json({ error: `Already sent ${new Date(task.sent_at).toLocaleDateString()}.`, alreadySent: true }, { status: 409 });
        if (task.status === "waiting") return NextResponse.json({ error: task.waiting_reason ?? "On hold." }, { status: 409 });
        const stale = new Date(Date.now() - 2 * 60_000).toISOString();
        const { data: claimed } = await db.from("tasks").update({ send_claimed_at: now }).eq("id", taskId).is("sent_at", null).or(`send_claimed_at.is.null,send_claimed_at.lt.${stale}`).select("id");
        if (!claimed?.length) return NextResponse.json({ error: "Someone is sending this right now.", alreadySent: true }, { status: 409 });
        return NextResponse.json({ ok: true });
      }
      if (action === "release_send") {
        await db.from("tasks").update({ send_claimed_at: null }).eq("id", taskId).is("sent_at", null);
        return NextResponse.json({ ok: true });
      }
      const draft = body.draft as { subject?: string; body?: string } | undefined;
      Object.assign(patch, { sent_at: now, send_claimed_at: null, status: "done", completed_at: now, completed_by: access.user.id, data: { ...task.data, draft: { subject: text(draft?.subject, 200), body: text(draft?.body, 5000) }, sentBy: access.user.id, manual: body.manual === true } });
      const { data: done } = await db.from("tasks").update(patch).eq("id", taskId).is("sent_at", null).select().maybeSingle();
      if (!done) return NextResponse.json({ error: "Already logged as sent.", alreadySent: true }, { status: 409 });
      await logActivity({ actorUserId: access.user.id, action: "task.outreach_sent", entityType: "event", entityId: id, eventId: id, metadata: { task: task.template_key, manual: body.manual === true } });
      return NextResponse.json({ task: done });
    } else if (action === "save_draft") {
      if (!staff || tpl?.kind !== "outreach") return NextResponse.json({ error: "Only booking staff edit outreach." }, { status: 403 });
      const draft = body.draft as { subject?: string; body?: string } | undefined;
      patch.data = { ...task.data, draft: { subject: text(draft?.subject, 200), body: text(draft?.body, 5000) } };
    }

    let { data, error } = await db.from("tasks").update(patch).eq("id", taskId).eq("event_id", id).select().single();
    // Before migration 0059 only the original columns exist: keep the plain checklist working.
    if (error && !action && ["42703", "PGRST204"].includes((error as { code?: string }).code ?? "")) {
      const legacy: Record<string, unknown> = {};
      if ("title" in patch) legacy.title = patch.title;
      if ("due_date" in patch) legacy.due_date = patch.due_date;
      if ("completed_at" in patch) legacy.completed_at = patch.completed_at;
      ({ data, error } = await db.from("tasks").update(legacy).eq("id", taskId).eq("event_id", id).select().single());
    }
    if (error) throw error;
    if (action) {
      await logActivity({ actorUserId: access.user.id, action: `task.${action}`, entityType: "event", entityId: id, eventId: id, metadata: { task: task.template_key ?? task.title } });
      await syncPlaybook(id); // e.g. a recap with an issue holds the outreach right away
    }
    return NextResponse.json({ task: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function DELETE(_req: NextRequest, { params }: P) {
  const { id, taskId } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });
  const db = createAdminClient();
  const { data: row } = await db.from("tasks").select("template_key, owner").eq("id", taskId).eq("event_id", id).maybeSingle();
  if (!row) return NextResponse.json({ error: "Task not found" }, { status: 404 });
  const rowOwner = (row as { owner: string | null }).owner;
  if (!access.isAdmin && rowOwner !== null && rowOwner !== "dj") return NextResponse.json({ error: "This one isn't yours to change." }, { status: 403 });
  // Playbook tasks are part of the workflow; only manual tasks can be deleted.
  if ((row as { template_key: string | null }).template_key && !(row as { template_key: string }).template_key.startsWith("request:")) return NextResponse.json({ error: "Playbook tasks can't be deleted." }, { status: 400 });
  try {
    const { error } = await db.from("tasks").delete().eq("id", taskId).eq("event_id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
