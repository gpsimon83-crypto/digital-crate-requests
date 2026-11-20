"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Check, ChevronDown, Circle, Clock, Copy, Lightbulb, Loader2, Pause, Plus, RotateCcw, Send, Trash2, X } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { STAGES, REQUEST_KINDS } from "@/lib/playbook";
import type { TaskView } from "@/lib/data/playbook";
import { cn } from "@/lib/utils";

type Viewer = "staff" | "dj";
type Payload = { isWedding: boolean; handedOff: boolean; tasks: TaskView[]; nextUpId: string | null; viewer: Viewer };

const dueLabel = (d: string | null) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : null);
function dueTone(d: string | null, done: boolean) {
  if (!d || done) return "text-muted";
  const today = new Date().toISOString().slice(0, 10);
  return d < today ? "text-status-declined" : d === today ? "text-status-pending" : "text-muted";
}

/**
 * The Wedding Playbook in the Tasks tab (admin) and on the DJ's project page.
 * One "Next up" task, then tasks grouped by stage (finished stages
 * collapsed), each coached: your next move, a tip, "ready when", actions.
 * Non-wedding events show their manual tasks the same way.
 */
export function PlaybookPanel({ eventId }: { eventId: string }) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [openStages, setOpenStages] = useState<Record<string, boolean>>({});

  const load = useCallback(() => {
    fetch(`/api/events/${eventId}/tasks`, { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => (ok ? setData(j) : setError(j.error ?? "Couldn't load tasks.")))
      .catch(() => setError("Couldn't load tasks."));
  }, [eventId]);
  useEffect(() => load(), [load]);

  async function act(task: TaskView, body: Record<string, unknown>) {
    setError(null);
    const r = await fetch(`/api/events/${eventId}/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setError(j.error ?? "Something went wrong.");
      return false;
    }
    load();
    return true;
  }

  const groups = useMemo(() => {
    if (!data) return [];
    const by = new Map<string, TaskView[]>();
    for (const t of data.tasks) {
      const g = t.stage ? `${t.stage}` : t.kind === "request" || t.kind === "issue" ? "requests" : "other";
      by.set(g, [...(by.get(g) ?? []), t]);
    }
    const order = [...STAGES.map((_, i) => `${i + 1}`), "requests", "other"];
    return order
      .filter((k) => by.has(k))
      .map((k) => ({
        key: k,
        name: k === "requests" ? "Requests & issues" : k === "other" ? (data.isWedding ? "Other tasks" : "Tasks") : `${k}. ${STAGES[Number(k) - 1]}`,
        tasks: by.get(k)!.sort((a, b) => (a.status === "done" ? 1 : 0) - (b.status === "done" ? 1 : 0) || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"))
      }));
  }, [data]);

  if (!data) return <GlassCard>{error ? <p className="text-sm text-status-declined">{error}</p> : <p className="text-sm text-muted">Loading tasks…</p>}</GlassCard>;
  const next = data.tasks.find((t) => t.id === data.nextUpId) ?? null;
  const viewer = data.viewer;

  return (
    <div className="flex flex-col gap-4" data-tour="playbook">
      {data.isWedding && (
        <GlassCard className="flex flex-col gap-3 border-gold/40" data-tour="playbook-next-up">
          <p className="text-[10px] font-semibold uppercase tracking-[2.5px] text-gold">Next up</p>
          {next ? (
            <>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <div className="min-w-0 flex-1">
                  <p className="font-display text-2xl leading-tight">{next.title}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="rounded-full bg-gold-soft px-2 py-0.5 font-semibold text-gold-dim">{next.ownerLabel}</span>
                    {next.due_date && <span className={dueTone(next.due_date, false)}>Due {dueLabel(next.due_date)}</span>}
                    {next.stageName && <span>{next.stageName}</span>}
                  </p>
                  {next.nextMove && <p className="mt-2 text-sm">{next.nextMove}</p>}
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  {next.link && (
                    <Link href={next.link.href} className="inline-flex items-center gap-1.5 rounded-[12px] px-4 py-2.5 text-sm font-semibold text-[var(--on-gold)] shadow-[0_8px_22px_-12px_var(--gold)] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" style={{ background: "linear-gradient(160deg, var(--gold-light), var(--gold) 60%)" }}>
                      {next.link.label} <ArrowRight size={15} />
                    </Link>
                  )}
                  <Button variant="secondary" size="sm" onClick={() => setOpenId(next.id)}>
                    How to do it
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">{viewer === "dj" && !data.handedOff ? "Your planning tasks open once the booking is handed off to you (contract signed, retainer in, you're assigned)." : "Nothing you can do right now. Waiting tasks below say who's up."}</p>
          )}
        </GlassCard>
      )}

      {error && <p className="text-sm text-status-declined">{error}</p>}

      {groups.map((g) => {
        const done = g.tasks.filter((t) => t.status === "done").length;
        const complete = done === g.tasks.length;
        const open = openStages[g.key] ?? (!complete || g.tasks.some((t) => t.id === openId));
        return (
          <GlassCard key={g.key} className="flex flex-col gap-0 p-0">
            <button
              type="button"
              aria-expanded={open}
              onClick={() => setOpenStages((s) => ({ ...s, [g.key]: !open }))}
              className="flex items-center gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
            >
              <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", complete ? "bg-status-approved/15 text-status-approved" : "bg-gold-soft text-gold-dim")}>{complete ? <Check size={13} /> : g.key.length === 1 ? g.key : "•"}</span>
              <span className="min-w-0 flex-1 text-sm font-semibold">{g.key.length === 1 ? g.name.replace(/^\d+\.\s/, "") : g.name}</span>
              <span className="text-xs text-muted">
                {done}/{g.tasks.length}
              </span>
              <ChevronDown size={16} className={cn("shrink-0 text-muted transition-transform", open && "rotate-180")} />
            </button>
            {open && (
              <ul className="flex flex-col gap-2 border-t border-border p-2 sm:gap-0 sm:p-0">
                {g.tasks.map((t) => (
                  <TaskItem key={t.id} eventId={eventId} task={t} viewer={viewer} expanded={openId === t.id} onToggle={() => setOpenId((o) => (o === t.id ? null : t.id))} act={act} reload={load} />
                ))}
              </ul>
            )}
          </GlassCard>
        );
      })}

      <AddBar eventId={eventId} isWedding={data.isWedding} onAdded={load} />
    </div>
  );
}

function TaskItem({
  eventId,
  task: t,
  viewer,
  expanded,
  onToggle,
  act,
  reload
}: {
  eventId: string;
  task: TaskView;
  viewer: Viewer;
  expanded: boolean;
  onToggle: () => void;
  act: (t: TaskView, b: Record<string, unknown>) => Promise<boolean>;
  reload: () => void;
}) {
  const done = t.status === "done";
  const waiting = t.status === "waiting" || !!t.blocked;
  const [tip, setTip] = useState(false);
  const [waitForm, setWaitForm] = useState(false);
  const [reason, setReason] = useState("");
  const [on, setOn] = useState<"staff" | "client" | "dj" | "booking_lead">("client");

  return (
    <li className="overflow-hidden rounded-[12px] border border-border bg-card sm:rounded-none sm:border-0 sm:border-t sm:bg-transparent sm:first:border-t-0" data-task={t.template_key ?? "manual"}>
      <button type="button" aria-expanded={expanded} onClick={onToggle} className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-panel/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold sm:items-center sm:px-4 sm:py-2.5">
        <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border sm:mt-0", done ? "border-status-approved bg-status-approved text-white" : waiting ? "border-status-pending text-status-pending" : "border-border text-transparent")}>
          {done ? <Check size={12} /> : waiting ? <Pause size={10} /> : <Circle size={6} />}
        </span>
        <span className="min-w-0 flex-1">
          <span className={cn("block text-sm", done && "text-muted line-through decoration-muted/60")}>{t.title}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted sm:hidden">
            <span>{t.ownerLabel}</span>
            {t.due_date && <span className={dueTone(t.due_date, done)}>{dueLabel(t.due_date)}</span>}
          </span>
          {t.review_note && !done && (
            <span className="mt-1 flex items-start gap-1 text-[11px] text-status-pending">
              <AlertTriangle size={11} className="mt-0.5 shrink-0" /> {t.review_note}
            </span>
          )}
          {!done && (t.blocked || t.status === "waiting") && (
            <span className="mt-1 block text-[11px] text-status-pending">
              {t.blocked ? `${t.blocked.missing} · ${t.blocked.who}` : `Waiting: ${t.waiting_reason}${t.waiting_on ? ` · ${t.waiting_on === "client" ? "Client" : t.waiting_on === "dj" ? "DJ" : t.waiting_on === "booking_lead" ? "Booking lead" : "Booking staff"}` : ""}`}
            </span>
          )}
        </span>
        <span className="hidden w-28 shrink-0 text-xs text-muted sm:block">{t.ownerLabel}</span>
        <span className={cn("hidden w-24 shrink-0 text-xs sm:block", dueTone(t.due_date, done))}>{dueLabel(t.due_date) ?? ""}</span>
        <ChevronDown size={15} className={cn("mt-0.5 shrink-0 text-muted transition-transform sm:mt-0", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="flex flex-col gap-3 border-t border-border bg-panel/30 px-4 py-3 text-sm">
          {t.nextMove && (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[2px] text-muted">Your next move</p>
              <p className="mt-0.5">{t.nextMove}</p>
              {t.link && (
                <Link href={t.link.href} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-gold-dim hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                  {t.link.label} <ArrowRight size={12} />
                </Link>
              )}
            </div>
          )}

          {t.template_key === "dj_review_booking" && <EquipmentPeek eventId={eventId} />}

          {t.tip && (
            <div>
              <button onClick={() => setTip((v) => !v)} aria-expanded={tip} className="flex items-center gap-1.5 text-xs font-medium text-gold-dim focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                <Lightbulb size={13} /> Coach&rsquo;s tip
                <ChevronDown size={12} className={cn("transition-transform", tip && "rotate-180")} />
              </button>
              {tip && <p className="mt-1 rounded-[10px] border border-gold/25 bg-gold-soft/50 p-3 text-xs leading-relaxed">{t.tip}</p>}
            </div>
          )}

          {t.kind === "recap" ? (
            <RecapForm task={t} disabled={!t.canAct || done} onSubmit={(recap) => act(t, { action: "recap", recap })} />
          ) : t.kind === "outreach" && viewer === "staff" ? (
            <OutreachBox eventId={eventId} task={t} act={act} reload={reload} />
          ) : (
            t.readyWhen.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[2px] text-muted">Ready when</p>
                <ul className="mt-1 flex flex-col gap-1">
                  {t.readyWhen.map((item) => {
                    const checked = done || !!t.checklist?.[item];
                    const canTick = t.canAct && !done && t.kind !== "objective";
                    return (
                      <li key={item}>
                        <label className={cn("flex items-start gap-2 text-sm", !canTick && "cursor-default")}>
                          <input type="checkbox" checked={checked} disabled={!canTick} onChange={(e) => void act(t, { checklist: { ...t.checklist, [item]: e.target.checked } })} className="mt-0.5 h-4 w-4 accent-[var(--gold)]" />
                          <span className={checked ? "text-muted" : ""}>{item}</span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )
          )}

          {t.kind === "issue" && t.data?.details != null && <p className="rounded-[10px] border border-status-pending/30 bg-status-pending/5 p-3 text-xs">{String(t.data.details)}</p>}
          {t.kind === "request" && (
            <p className="rounded-[10px] border border-border bg-panel p-3 text-xs">
              <span className="font-semibold">{String(t.data?.requestedBy ?? "DJ")} asked:</span> {String(t.data?.details ?? "")}
              {viewer === "dj" && <span className="mt-1 block text-muted">The booking lead reviews pricing and changes; you&rsquo;ll see the outcome here.</span>}
            </p>
          )}

          {waitForm && (
            <div className="flex flex-col gap-2 rounded-[10px] border border-border bg-card p-3">
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="What's missing?" className="rounded-[8px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none" />
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-muted">Who needs to act:</span>
                <select value={on} onChange={(e) => setOn(e.target.value as typeof on)} className="rounded-[8px] border border-black/10 bg-panel px-2 py-1.5 text-sm focus:border-gold focus:outline-none">
                  <option value="client">Client</option>
                  <option value="staff">Booking staff</option>
                  <option value="booking_lead">Booking lead</option>
                  <option value="dj">DJ</option>
                </select>
                <Button size="sm" variant="primary" disabled={!reason.trim()} onClick={() => void act(t, { action: "waiting", reason, waitingOn: on }).then((ok) => ok && setWaitForm(false))}>
                  Mark waiting
                </Button>
                <button onClick={() => setWaitForm(false)} className="text-muted hover:text-foreground">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            {t.link && (
              <Link href={t.link.href} className="inline-flex items-center gap-1 rounded-[10px] border border-border px-3 py-1.5 text-xs font-medium hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                Open record
              </Link>
            )}
            {t.canAct && !done && t.kind !== "objective" && t.kind !== "recap" && t.kind !== "outreach" && !(t.kind === "request" && viewer !== "staff") && (
              <>
                {t.status !== "waiting" && !waitForm && (
                  <Button size="sm" variant="secondary" onClick={() => setWaitForm(true)}>
                    <Pause size={13} /> Mark waiting
                  </Button>
                )}
                <Button size="sm" variant="primary" onClick={() => void act(t, { action: "ready" })}>
                  <Check size={13} /> Mark ready
                </Button>
              </>
            )}
            {t.canAct && !done && t.status === "waiting" && t.waiting_reason && !t.waiting_reason.startsWith("Held") && (
              <Button size="sm" variant="text" onClick={() => void act(t, { action: "reopen" })}>
                Not waiting anymore
              </Button>
            )}
            {t.canAct && done && t.kind !== "objective" && t.kind !== "outreach" && (
              <Button size="sm" variant="text" onClick={() => void act(t, { action: "reopen" })}>
                <RotateCcw size={13} /> Reopen
              </Button>
            )}
            {t.kind === "objective" && !done && <span className="text-[11px] text-muted">Completes itself when the record is in.</span>}
            {!t.coached && t.kind !== "issue" && t.canAct && (t.kind !== "request" || viewer === "staff") && (
              <button
                onClick={() => void fetch(`/api/events/${eventId}/tasks/${t.id}`, { method: "DELETE" }).then(reload)}
                className="ml-auto flex items-center gap-1 text-xs text-muted hover:text-status-declined"
                aria-label={`Delete ${t.title}`}
              >
                <Trash2 size={12} /> Delete
              </button>
            )}
          </div>
          {t.canAct && !done && t.coached && t.due_date && (
            <DueEditor due={t.due_date} overridden={t.due_overridden} onSave={(d) => void act(t, { dueDate: d })} />
          )}
        </div>
      )}
    </li>
  );
}

function DueEditor({ due, overridden, onSave }: { due: string; overridden: boolean; onSave: (d: string) => void }) {
  const [v, setV] = useState(due);
  return (
    <label className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
      <Clock size={12} /> Due
      <input type="date" value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v && v !== due && onSave(v)} className="rounded-[8px] border border-black/10 bg-panel px-2 py-1 text-xs focus:border-gold focus:outline-none" />
      {overridden ? "set by hand (won't move if the date changes)" : "moves with the wedding date unless you change it"}
    </label>
  );
}

function RecapForm({ task, disabled, onSubmit }: { task: TaskView; disabled: boolean; onSubmit: (r: Record<string, string>) => Promise<boolean> }) {
  const d = task.data as Record<string, string | undefined>;
  const [r, setR] = useState({ worked: d.worked ?? "", improvement: d.improvement ?? "", issue: d.issue ?? "", personal: d.personal ?? "" });
  const [busy, setBusy] = useState(false);
  const fields: [keyof typeof r, string, string][] = [
    ["worked", "What worked", "Packed floor after the grand entrance…"],
    ["improvement", "One improvement", "Get the toast order from the planner earlier"],
    ["issue", "Any outstanding issue (leave blank if none)", "e.g. the venue's power tripped during dinner"],
    ["personal", "One personal detail for the thank-you", "Grandma's dance to September"]
  ];
  return (
    <div className="flex flex-col gap-2">
      {fields.map(([k, label, ph]) => (
        <label key={k} className="flex flex-col gap-1 text-xs">
          <span className="text-muted">{label}</span>
          <textarea value={r[k]} onChange={(e) => setR({ ...r, [k]: e.target.value })} disabled={disabled} placeholder={ph} rows={2} className="rounded-[8px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none disabled:opacity-70" />
        </label>
      ))}
      {!disabled && (
        <Button
          variant="primary"
          size="sm"
          className="self-start"
          disabled={busy || !r.worked.trim() || !r.improvement.trim() || !r.personal.trim()}
          onClick={() => {
            setBusy(true);
            void onSubmit(r).finally(() => setBusy(false));
          }}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Submit recap
        </Button>
      )}
      {task.status === "done" && <p className="text-[11px] text-status-approved">Submitted{task.data?.issue ? "; the issue went to booking staff and review outreach is on hold until it's resolved." : "."}</p>}
    </div>
  );
}

function OutreachBox({ eventId, task, act, reload }: { eventId: string; task: TaskView; act: (t: TaskView, b: Record<string, unknown>) => Promise<boolean>; reload: () => void }) {
  const [subject, setSubject] = useState(task.draft?.subject ?? "");
  const [body, setBody] = useState(task.draft?.body ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const held = task.status === "waiting";
  if (task.sent_at)
    return (
      <p className="flex items-center gap-1.5 text-xs text-status-approved">
        <Check size={13} /> Sent {new Date(task.sent_at).toLocaleDateString()}
        {task.data?.manual ? " (logged by hand)" : ""}. It won&rsquo;t be sent again.
      </p>
    );
  if (task.status === "done") return <p className="text-xs text-muted">Skipped.</p>;

  async function send() {
    setBusy(true);
    setMsg(null);
    const claim = await fetch(`/api/events/${eventId}/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "claim_send" }) });
    if (!claim.ok) {
      setBusy(false);
      setMsg((await claim.json().catch(() => ({}))).error ?? "Couldn't start sending.");
      reload();
      return;
    }
    const sent = await fetch(`/api/events/${eventId}/messages`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ subject, body }) });
    if (!sent.ok) {
      await fetch(`/api/events/${eventId}/tasks/${task.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "release_send" }) });
      setBusy(false);
      setMsg(`${(await sent.json().catch(() => ({}))).error ?? "Couldn't send."} You can copy the draft, send it another way, then log it as sent.`);
      return;
    }
    await act(task, { action: "log_sent", draft: { subject, body } });
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {held && <p className="rounded-[10px] border border-status-pending/30 bg-status-pending/5 p-2.5 text-xs text-status-pending">{task.waiting_reason}</p>}
      <input value={subject} onChange={(e) => setSubject(e.target.value)} onBlur={() => void act(task, { action: "save_draft", draft: { subject, body } })} className="rounded-[8px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none" aria-label="Subject" />
      <textarea value={body} onChange={(e) => setBody(e.target.value)} onBlur={() => void act(task, { action: "save_draft", draft: { subject, body } })} rows={7} className="rounded-[8px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none" aria-label="Message" />
      {msg && <p className="text-xs text-status-declined">{msg}</p>}
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="primary" size="sm" disabled={busy || held || !body.trim()} onClick={() => void send()}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send through messages
        </Button>
        <Button variant="secondary" size="sm" onClick={() => void navigator.clipboard?.writeText(`${subject}\n\n${body}`)}>
          <Copy size={13} /> Copy
        </Button>
        <Button variant="text" size="sm" disabled={held} onClick={() => void act(task, { action: "log_sent", draft: { subject, body }, manual: true })}>
          Log as sent
        </Button>
        {task.optional && (
          <Button variant="text" size="sm" onClick={() => void act(task, { action: "ready" })}>
            <X size={13} /> Skip
          </Button>
        )}
      </div>
    </div>
  );
}

type PlanLine = { key: string; spaceLabel: string; quantity: number; equipmentName: string | null; category: string | null };
function EquipmentPeek({ eventId }: { eventId: string }) {
  const [v, setV] = useState<{ lines: PlanLine[]; confirmed: { name: string; quantity: number }[]; usedInputs: string[] } | null>(null);
  useEffect(() => {
    fetch(`/api/admin/events/${eventId}/equipment-plan`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then(setV)
      .catch(() => {});
  }, [eventId]);
  if (!v || (!v.lines?.length && !v.confirmed?.length)) return null;
  return (
    <div className="grid gap-3 rounded-[10px] border border-border bg-card p-3 text-xs sm:grid-cols-2">
      <div>
        <p className="font-semibold">Recommended (not confirmed)</p>
        {v.usedInputs?.length > 0 && <p className="text-muted">{v.usedInputs.join(" · ")}</p>}
        <ul className="mt-1 flex flex-col gap-0.5">
          {v.lines.map((l) => (
            <li key={l.key}>
              {l.spaceLabel}: {l.quantity} × {l.equipmentName ?? l.category}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <p className="font-semibold">Confirmed by staff</p>
        {v.confirmed.length ? (
          <ul className="mt-1 flex flex-col gap-0.5">
            {v.confirmed.map((c, i) => (
              <li key={i}>
                {c.quantity} × {c.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-muted">Nothing confirmed yet.</p>
        )}
      </div>
    </div>
  );
}

function AddBar({ eventId, isWedding, onAdded }: { eventId: string; isWedding: boolean; onAdded: () => void }) {
  const [mode, setMode] = useState<null | "task" | "request">(null);
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [kind, setKind] = useState<keyof typeof REQUEST_KINDS>("extra_coverage");
  const [details, setDetails] = useState("");
  const [err, setErr] = useState<string | null>(null);
  async function submit() {
    setErr(null);
    const body = mode === "request" ? { request: { kind, details } } : { title, dueDate: due || null };
    const r = await fetch(`/api/events/${eventId}/tasks`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (!r.ok) return setErr((await r.json().catch(() => ({}))).error ?? "Couldn't add.");
    setTitle("");
    setDue("");
    setDetails("");
    setMode(null);
    onAdded();
  }
  const input = "rounded-[8px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" onClick={() => setMode(mode === "task" ? null : "task")}>
          <Plus size={13} /> Add task
        </Button>
        {isWedding && (
          <Button variant="secondary" size="sm" onClick={() => setMode(mode === "request" ? null : "request")} data-tour="playbook-request">
            <Plus size={13} /> Request a change
          </Button>
        )}
      </div>
      {mode === "task" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task" className={cn(input, "flex-1")} />
          <input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={input} />
          <Button variant="primary" size="sm" disabled={!title.trim()} onClick={() => void submit()}>
            Add
          </Button>
        </div>
      )}
      {mode === "request" && (
        <div className="flex flex-col gap-2 rounded-[12px] border border-border bg-card p-3">
          <p className="text-xs text-muted">Extra coverage, overtime or a package change goes to the booking lead, who handles pricing with the client.</p>
          <select value={kind} onChange={(e) => setKind(e.target.value as keyof typeof REQUEST_KINDS)} className={input}>
            {Object.entries(REQUEST_KINDS).map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <textarea value={details} onChange={(e) => setDetails(e.target.value)} rows={2} placeholder="What the couple asked for, and when" className={input} />
          <Button variant="primary" size="sm" className="self-start" disabled={!details.trim()} onClick={() => void submit()}>
            Send to booking lead
          </Button>
        </div>
      )}
      {err && <p className="text-xs text-status-declined">{err}</p>}
    </div>
  );
}
