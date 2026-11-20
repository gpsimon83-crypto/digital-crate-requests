/**
 * Wedding Playbook — database side. `syncPlaybook` is safe to run any number
 * of times: each template task is created once per event (unique index on
 * event + template), objective tasks follow their records, open date-based
 * tasks follow the wedding date (unless someone set the date by hand),
 * reviewed tasks reopen with a reason when a detail they depend on changes,
 * and outreach is held while an issue from the wedding is open.
 * Manual tasks and finished work are never touched.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { linkForEvent, weddingBasicsTemplate } from "@/lib/data/questionnaire-links";
import {
  changeNotes,
  DEFAULT_TIMING,
  draftFor,
  dueFor,
  handedOff,
  ISSUE_KEY,
  blockedReason,
  nextUp,
  ownerLabel,
  snapshot,
  STAGES,
  templateByKey,
  TEMPLATES,
  type Facts,
  type Owner,
  type Snapshot,
  type TaskLike,
  type Viewer
} from "@/lib/playbook";

type Db = ReturnType<typeof createAdminClient>;

export type TaskRecord = TaskLike & {
  event_id: string;
  completed_at: string | null;
  completed_by: string | null;
  due_overridden: boolean;
  checklist: Record<string, boolean>;
  data: Record<string, unknown>;
  reviewed_snapshot: Snapshot | null;
  sent_at: string | null;
  send_claimed_at: string | null;
  created_by: string | null;
  updated_at?: string;
};

const HOLD = "Held while an issue from the wedding is open.";

export async function loadFacts(db: Db, eventId: string): Promise<Facts | null> {
  const { data: ev } = await db
    .from("events")
    .select("id, event_category, starts_at, timezone, created_at, venue_name, expected_guests, dj_id, wedding_music_plan, wedding_music_plan_sent_at, package_selection_id, venues(name), djs(display_name), clients(first_name)")
    .eq("id", eventId)
    .maybeSingle();
  if (!ev) return null;
  const e = ev as unknown as {
    event_category: string | null;
    starts_at: string | null;
    timezone: string | null;
    created_at: string;
    venue_name: string | null;
    expected_guests: number | null;
    dj_id: string | null;
    wedding_music_plan: Record<string, unknown> | null;
    wedding_music_plan_sent_at: string | null;
    package_selection_id: string | null;
    venues: { name: string } | null;
    djs: { display_name: string } | null;
    clients: { first_name: string | null } | null;
  };
  const one = async <T>(p: PromiseLike<{ data: T | null; error: unknown }>): Promise<T | null> => {
    try {
      const r = await p;
      return r.error ? null : r.data;
    } catch {
      return null;
    }
  };
  const contracts = (await one(db.from("contracts").select("status").eq("event_id", eventId))) as { status: string }[] | null;
  const payments = (await one(db.from("payments").select("status").eq("event_id", eventId))) as { status: string }[] | null;
  const selections = (await one(db.from("event_package_selections").select("status").eq("event_id", eventId).eq("is_current", true))) as { status: string }[] | null;
  const response = (await one(db.from("questionnaire_responses").select("completed_at").eq("event_id", eventId).maybeSingle())) as { completed_at: string | null } | null;
  const plan = (await one(db.from("event_equipment_plans").select("confirmed_at").eq("event_id", eventId).maybeSingle())) as { confirmed_at: string | null } | null;
  const settings = (await one(db.from("platform_settings").select("review_url").eq("id", true).maybeSingle())) as { review_url: string | null } | null;
  let coverage: string[] | null = null;
  try {
    const t = await weddingBasicsTemplate();
    const answers = t ? (await linkForEvent(db, eventId, t.id))?.answers : null;
    const v = answers?.coverage;
    if (v && !("unsure" in v) && Array.isArray(v.value)) coverage = v.value.filter((x): x is string => typeof x === "string");
  } catch {
    // no Wedding Basics
  }
  const music = e.wedding_music_plan ?? {};
  return {
    isWedding: e.event_category === "wedding",
    startsAt: e.starts_at,
    timezone: e.timezone,
    createdAt: e.created_at,
    venue: e.venues?.name ?? e.venue_name,
    guests: e.expected_guests,
    coverage,
    djAssigned: !!e.dj_id,
    djName: e.djs?.display_name ?? null,
    clientFirst: e.clients?.first_name ?? null,
    proposalSent: !!e.package_selection_id || (selections ?? []).length > 0,
    contractSigned: (contracts ?? []).some((c) => c.status === "signed"),
    retainerPaid: (payments ?? []).some((p) => p.status === "succeeded"),
    questionnaireDone: !!response?.completed_at,
    musicPlanSent: !!e.wedding_music_plan_sent_at,
    musicPlanDone: !!e.wedding_music_plan_sent_at && typeof music.first_dance_song === "string" && !!music.first_dance_song.trim(),
    equipmentConfirmed: !!plan?.confirmed_at,
    reviewUrl: settings?.review_url ?? null
  };
}

async function loadTiming(db: Db) {
  const timing = { ...DEFAULT_TIMING } as Record<string, { anchor: "event" | "booked"; offset: number; active?: boolean }>;
  const { data, error } = await db.from("playbook_task_timing").select("key, anchor, offset_days, active");
  // No timing table means migration 0059 hasn't run: the playbook stays off and tasks work as before.
  if (error) return null;
  for (const r of (data ?? []) as { key: string; anchor: "event" | "booked"; offset_days: number; active: boolean }[]) timing[r.key] = { anchor: r.anchor, offset: r.offset_days, active: r.active };
  return timing;
}

export async function listEventTasks(db: Db, eventId: string): Promise<TaskRecord[]> {
  const { data, error } = await db.from("tasks").select("*").eq("event_id", eventId).order("created_at", { ascending: true });
  if (error) throw error;
  return ((data ?? []) as Partial<TaskRecord>[]).map((t) => ({
    status: t.completed_at ? "done" : "open",
    owner: null,
    stage: null,
    template_key: null,
    waiting_reason: null,
    waiting_on: null,
    review_note: null,
    due_overridden: false,
    checklist: {},
    data: {},
    reviewed_snapshot: null,
    sent_at: null,
    send_claimed_at: null,
    completed_by: null,
    ...t
  })) as TaskRecord[];
}

/** Create missing template tasks and bring auto-managed fields up to date. Idempotent. */
export async function syncPlaybook(eventId: string): Promise<{ created: number; updated: number; facts: Facts | null; ready: boolean }> {
  const db = createAdminClient();
  const facts = await loadFacts(db, eventId);
  if (!facts?.isWedding) return { created: 0, updated: 0, facts, ready: true };
  const timing = await loadTiming(db);
  if (!timing) return { created: 0, updated: 0, facts, ready: false };
  let tasks = await listEventTasks(db, eventId);
  const have = new Set(tasks.map((t) => t.template_key).filter(Boolean));

  let created = 0;
  const missing = TEMPLATES.filter((t) => !have.has(t.key) && timing[t.key]?.active !== false);
  for (const t of missing) {
    const done = t.kind === "objective" && !!t.objective?.(facts);
    const { error } = await db.from("tasks").insert({
      event_id: eventId,
      template_key: t.key,
      stage: t.stage,
      owner: t.owner,
      title: t.title,
      due_date: timing[t.key] ? dueFor(timing[t.key], facts) : null,
      status: done ? "done" : "open",
      completed_at: done ? new Date().toISOString() : null,
      data: done ? { auto: true } : {}
    });
    // Another sync created it at the same moment: the unique index keeps one.
    if (error && (error as { code?: string }).code !== "23505") throw error;
    if (!error) created++;
  }
  if (created) tasks = await listEventTasks(db, eventId);

  let updated = 0;
  const now = new Date().toISOString();
  const issueOpen = tasks.some((t) => t.template_key === ISSUE_KEY && t.status !== "done");
  for (const t of tasks) {
    const tpl = templateByKey(t.template_key);
    if (!tpl) continue;
    const patch: Record<string, unknown> = {};
    // Objective tasks follow their records (and reopen if a record is undone, e.g. a voided contract).
    if (tpl.kind === "objective" && tpl.objective) {
      const ok = tpl.objective(facts);
      if (ok && t.status !== "done") Object.assign(patch, { status: "done", completed_at: now, completed_by: null, waiting_reason: null, waiting_on: null, data: { ...t.data, auto: true } });
      if (!ok && t.status === "done" && t.data?.auto) Object.assign(patch, { status: "open", completed_at: null, data: { ...t.data, auto: false } });
    }
    // Open date-based tasks follow the wedding date, unless the due date was set by hand.
    if (t.status !== "done" && !t.due_overridden && timing[tpl.key]) {
      const due = dueFor(timing[tpl.key], facts);
      if (due !== t.due_date) patch.due_date = due;
    }
    // A reviewed task whose details changed reopens with the reason.
    if (t.status === "done" && tpl.kind === "judgment" && tpl.watch?.length && t.reviewed_snapshot) {
      const notes = changeNotes(t.reviewed_snapshot, facts, tpl.watch);
      if (notes.length) Object.assign(patch, { status: "open", completed_at: null, review_note: notes.join(" "), reviewed_snapshot: null });
    }
    // Review and referral outreach wait while an issue is open.
    if ((tpl.key === "staff_review_request" || tpl.key === "staff_referral") && !t.sent_at) {
      if (issueOpen && t.status === "open") Object.assign(patch, { status: "waiting", waiting_reason: HOLD, waiting_on: "staff" });
      if (!issueOpen && t.status === "waiting" && t.waiting_reason === HOLD) Object.assign(patch, { status: "open", waiting_reason: null, waiting_on: null });
    }
    if (Object.keys(patch).length) {
      await db.from("tasks").update({ ...patch, updated_at: now }).eq("id", t.id);
      updated++;
    }
  }
  return { created, updated, facts, ready: true };
}

export type TaskView = TaskRecord & {
  coached: boolean;
  stageName: string | null;
  ownerLabel: string;
  nextMove: string | null;
  link: { label: string; href: string } | null;
  tip: string | null;
  readyWhen: string[];
  blocked: { missing: string; who: string } | null;
  canAct: boolean;
  kind: string | null;
  optional: boolean;
  draft: { subject: string; body: string } | null;
};

/** The tasks a viewer sees, with coaching, links for their side of the app, and what blocks each. */
export async function playbookView(eventId: string, viewer: Viewer) {
  const { facts: loaded, ready } = await syncPlaybook(eventId);
  const db = createAdminClient();
  const tasks = await listEventTasks(db, eventId);
  // Before migration 0059 the event shows its plain tasks, like any non-wedding event.
  const f = (ready ? loaded : loaded ? { ...loaded, isWedding: false } : null) as Facts;
  const visible = tasks.filter((t) => (viewer === "staff" ? true : viewer === "dj" ? t.owner === "dj" || t.owner === "client" || t.owner == null : t.owner === "client"));
  const recap = (tasks.find((t) => t.template_key === "dj_recap")?.data ?? null) as { personal?: string } | null;
  const views: TaskView[] = visible.map((t) => {
    const tpl = templateByKey(t.template_key);
    const raw = tpl?.link;
    const href = raw ? (viewer === "client" ? raw.client : viewer === "dj" ? raw.dj : raw.staff) : undefined;
    const b = f ? blockedReason(t, tasks, f) : null;
    const canAct = viewer === "staff" ? t.owner !== "client" : viewer === "dj" ? t.owner === "dj" || t.owner == null : false;
    return {
      ...t,
      coached: !!tpl,
      stageName: t.stage ? STAGES[t.stage - 1] : null,
      ownerLabel: ownerLabel(t.owner, viewer),
      nextMove: tpl?.nextMove ?? (t.data?.details as string | undefined) ?? null,
      link: href ? { label: raw!.label, href: href.replaceAll("{id}", eventId) } : null,
      tip: tpl?.tip ?? null,
      readyWhen: tpl?.readyWhen ?? [],
      blocked: b ? { missing: b.missing, who: ownerLabel(b.who as Owner, viewer) } : null,
      canAct,
      kind: tpl?.kind ?? (t.template_key === ISSUE_KEY ? "issue" : t.template_key?.startsWith("request:") ? "request" : null),
      optional: !!tpl?.optional,
      draft: tpl?.kind === "outreach" && viewer === "staff" && f ? ((t.data?.draft as { subject: string; body: string } | undefined) ?? draftFor(tpl.key, f, recap)) : null
    };
  });
  const next = f ? nextUp(views, f, viewer) : null;
  return { isWedding: !!f?.isWedding, handedOff: f ? handedOff(f) : false, facts: f, tasks: views, nextUpId: next?.id ?? null };
}

export { snapshot, templateByKey };
