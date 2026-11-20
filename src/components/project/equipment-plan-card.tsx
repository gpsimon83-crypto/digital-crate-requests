"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Check, ChevronDown, Gem, Loader2, Mic, Speaker, Wine, X } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { EquipmentAssignmentsPanel } from "./equipment-assignments-panel";
import type { PlanLine, PlanView } from "@/lib/data/equipment-plans";
import { cn } from "@/lib/utils";

const SPACE_ICON = { reception: Speaker, ceremony: Gem, cocktail: Wine, microphones: Mic } as const;
const STATUS: Record<PlanView["status"], { label: string; tone: string }> = {
  proposed: { label: "Review required", tone: "border-gold/60 bg-gold-soft text-gold-dim" },
  incomplete: { label: "Needs details", tone: "border-status-pending/40 bg-status-pending/10 text-status-pending" },
  needs_review: { label: "Changed: review", tone: "border-status-pending/40 bg-status-pending/10 text-status-pending" },
  confirmed: { label: "Confirmed", tone: "border-status-approved/40 bg-status-approved/10 text-status-approved" },
  no_rules: { label: "Not set up", tone: "border-border bg-panel text-muted" }
};

type Inventory = { id: string; name: string; category: string; quantity_owned: number };
type Draft = { key: string; space: PlanLine["space"]; label: string; reason: string; include: boolean; equipmentId: string; quantity: number; category: string | null };
type Conflict = { equipmentId: string; requested: number; available: number; conflictingEvents: { eventId: string; title: string | null; startsAt: string | null; quantity: number }[] };

/**
 * Equipment on the project Details tab: what the questionnaire says the
 * event needs, the proposed setup per space with the reason for each item,
 * and what's actually assigned. Recommendations become assignments only
 * when staff confirm them in "Review recommendations".
 */
export function EquipmentPlanCard({ eventId }: { eventId: string }) {
  const [view, setView] = useState<PlanView | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [rev, setRev] = useState(0);

  const load = useCallback(() => {
    fetch(`/api/admin/events/${eventId}/equipment-plan`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((v) => {
        setView(v);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [eventId]);
  useEffect(() => load(), [load]);

  const groups = useMemo(() => {
    const m = new Map<string, PlanLine[]>();
    for (const l of view?.lines ?? []) m.set(l.space, [...(m.get(l.space) ?? []), l]);
    return [...m.entries()];
  }, [view]);

  const status = view ? STATUS[view.status] : null;

  return (
    <GlassCard className="flex flex-col gap-4" data-tour="equipment-plan">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold">
          <Speaker size={18} strokeWidth={1.6} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-display text-xl leading-tight">Equipment</p>
            {status && (
              <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold", status.tone)}>
                {view?.status === "confirmed" ? <Check size={11} /> : <AlertTriangle size={11} />} {status.label}
              </span>
            )}
          </div>
          {view && view.usedInputs.length > 0 && <p className="mt-0.5 text-xs text-muted">From the event and questionnaire · {view.usedInputs.join(" · ")}</p>}
        </div>
      </div>

      {failed && <p className="text-xs text-muted">Couldn&rsquo;t load recommendations right now. You can still assign gear below.</p>}
      {view?.status === "no_rules" && <p className="rounded-[10px] bg-panel p-3 text-xs text-muted">Run migration 0058_equipment_setup_plans.sql to turn on equipment recommendations. Manual assigning below works as before.</p>}

      {view && (view.plan?.needsReview || view.missing.length > 0 || view.flags.length > 0 || view.uncovered.length > 0) && (
        <div className="flex flex-col gap-1.5 rounded-[10px] border border-status-pending/30 bg-status-pending/5 p-3 text-xs">
          {view.plan?.needsReview && (
            <p>
              <span className="font-semibold">Changed since it was confirmed:</span> {view.plan.changes.join(", ") || "event details"}. The assignments below stay as they are until you review.
            </p>
          )}
          {view.flags.map((f) => (
            <p key={f}>
              <span className="font-semibold">Timing:</span> {f}
            </p>
          ))}
          {view.missing.map((m) => (
            <p key={m.field}>
              <span className="font-semibold">{m.label}:</span> <span className="text-muted">{m.ask}</span>
            </p>
          ))}
          {view.uncovered.length > 0 && (
            <p>
              <span className="font-semibold">No rule matches:</span> {view.uncovered.join(", ")}. Assign manually below, or add a rule in Admin → Equipment.
            </p>
          )}
        </div>
      )}

      {groups.length > 0 && (
        <div className="flex flex-col gap-2">
          {groups.map(([space, lines]) => {
            const Icon = SPACE_ICON[space as keyof typeof SPACE_ICON];
            const short = lines.some((l) => l.noGear || (l.available != null && l.available < l.quantity));
            return (
              <div key={space} className="overflow-hidden rounded-[12px] border border-border bg-panel/40">
                <button
                  type="button"
                  aria-expanded={open === space}
                  onClick={() => setOpen((o) => (o === space ? null : space))}
                  className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-panel/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-gold"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-card text-gold">
                    <Icon size={17} strokeWidth={1.6} />
                  </span>
                  <span className="w-36 shrink-0 text-sm font-semibold sm:w-40">{lines[0].spaceLabel}</span>
                  <span className="min-w-0 flex-1 truncate border-l border-border pl-3 text-sm text-muted">
                    {lines.map((l) => `${l.quantity} × ${l.equipmentName ?? l.category ?? "gear"}`).join(" · ")}
                  </span>
                  {short && <AlertTriangle size={14} className="shrink-0 text-status-pending" aria-label="Some items aren't available" />}
                  <ChevronDown size={16} className={cn("shrink-0 text-muted transition-transform", open === space && "rotate-180")} />
                </button>
                {open === space && (
                  <ul className="flex flex-col gap-1.5 border-t border-border px-4 py-3 text-xs">
                    {lines.map((l) => (
                      <li key={l.key} className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                        <span>
                          <span className="font-medium">
                            {l.quantity} × {l.equipmentName ?? `${l.category ?? "gear"} (none in inventory)`}
                          </span>
                          <span className="text-muted">: {l.reason}</span>
                        </span>
                        <span className={cn("shrink-0", l.noGear || (l.available ?? 0) < l.quantity ? "text-status-pending" : "text-muted")}>
                          {l.noGear ? "Not in inventory" : `${Math.max(0, l.available ?? 0)} free for this date`}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="border-t border-border pt-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Assigned to this event</p>
          {view?.plan?.confirmedAt && <p className="text-[11px] text-muted">Plan confirmed {new Date(view.plan.confirmedAt).toLocaleDateString()}</p>}
        </div>
        <EquipmentAssignmentsPanel eventId={eventId} bare refreshKey={rev} onChange={load} />
      </div>

      {view && view.lines.length > 0 && (
        <div className="flex justify-end">
          <Button variant="primary" onClick={() => setReviewing(true)} data-tour="equipment-review">
            Review recommendations
          </Button>
        </div>
      )}

      {reviewing && view && (
        <ReviewDialog
          eventId={eventId}
          view={view}
          onClose={() => setReviewing(false)}
          onConfirmed={(v) => {
            setView(v);
            setRev((n) => n + 1);
            setReviewing(false);
          }}
        />
      )}
    </GlassCard>
  );
}

function ReviewDialog({ eventId, view, onClose, onConfirmed }: { eventId: string; view: PlanView; onClose: () => void; onConfirmed: (v: PlanView) => void }) {
  const [inventory, setInventory] = useState<Inventory[]>([]);
  const [drafts, setDrafts] = useState<Draft[]>(() =>
    view.lines.map((l) => ({ key: l.key, space: l.space, label: l.label, reason: l.reason, include: !l.noGear, equipmentId: l.equipmentId ?? "", quantity: l.quantity, category: l.category }))
  );
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/admin/equipment")
      .then((r) => r.json())
      .then((j) => setInventory((j.equipment ?? []) as Inventory[]))
      .catch(() => {});
  }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  const set = (key: string, patch: Partial<Draft>) => {
    setConflicts(null);
    setDrafts((d) => d.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  };
  const chosen = drafts.filter((d) => d.include && d.equipmentId);
  const nameOf = (id: string) => inventory.find((i) => i.id === id)?.name ?? "Equipment";

  async function confirm(force: boolean) {
    setBusy(true);
    setError(null);
    const r = await fetch(`/api/admin/events/${eventId}/equipment-plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force, items: chosen.map((d) => ({ key: d.key, space: d.space, label: d.label, equipmentId: d.equipmentId, quantity: d.quantity, reason: d.reason })) })
    });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (r.status === 409) return setConflicts(j.conflicts ?? []);
    if (!r.ok) return setError(j.error ?? "Couldn't confirm.");
    onConfirmed(j.view);
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-label="Review equipment recommendations">
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="relative flex max-h-[92dvh] w-full max-w-3xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-[0_16px_50px_rgba(0,0,0,0.3)] sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
          <div>
            <p className="font-display text-xl">Review recommendations</p>
            <p className="text-xs text-muted">Adjust items and quantities, then confirm. Only what you confirm is assigned; confirming again updates the same assignments.</p>
          </div>
          <button onClick={onClose} className="rounded-full p-1.5 text-muted hover:bg-panel hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-2 overflow-y-auto px-5 py-4">
          {drafts.map((d) => {
            const options = inventory.filter((i) => !d.category || i.category.toLowerCase() === d.category.toLowerCase() || i.id === d.equipmentId);
            const line = view.lines.find((l) => l.key === d.key)!;
            return (
              <div key={d.key} className={cn("grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-2 rounded-[12px] border p-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,14rem)_5rem]", d.include ? "border-border" : "border-dashed border-border opacity-60")}>
                <input type="checkbox" checked={d.include} onChange={(e) => set(d.key, { include: e.target.checked })} className="mt-1 h-4 w-4 accent-[var(--gold)]" aria-label={`Include ${d.label}`} />
                <div className="min-w-0">
                  <p className="text-sm font-medium">
                    <span className="text-muted">{line.spaceLabel} · </span>
                    {d.label}
                  </p>
                  <p className="text-xs text-muted">{d.reason}</p>
                  <p className={cn("text-[11px]", line.noGear || (line.available ?? 0) < d.quantity ? "text-status-pending" : "text-muted")}>
                    {line.noGear ? "No matching gear in the inventory: pick an item or leave it out" : `${Math.max(0, line.available ?? 0)} of ${line.equipmentName} free for this date`}
                  </p>
                </div>
                <select
                  value={d.equipmentId}
                  onChange={(e) => set(d.key, { equipmentId: e.target.value, include: !!e.target.value && d.include })}
                  className="col-start-2 min-w-0 rounded-[10px] border border-black/10 bg-panel px-2.5 py-2 text-sm focus:border-gold focus:outline-none sm:col-start-auto"
                  aria-label={`Item for ${d.label}`}
                >
                  <option value="">Choose an item…</option>
                  {options.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.name} ({o.quantity_owned} owned)
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={d.quantity}
                  onChange={(e) => set(d.key, { quantity: Math.max(1, Math.min(50, Number(e.target.value) || 1)) })}
                  className="col-start-2 w-20 rounded-[10px] border border-black/10 bg-panel px-2.5 py-2 text-sm focus:border-gold focus:outline-none sm:col-start-auto"
                  aria-label={`Quantity for ${d.label}`}
                />
              </div>
            );
          })}
        </div>

        <div className="flex flex-col gap-3 border-t border-border px-5 py-4">
          {conflicts && conflicts.length > 0 && (
            <div className="flex flex-col gap-1.5 rounded-[10px] border border-status-declined/40 bg-status-declined/5 p-3 text-xs">
              <p className="flex items-center gap-1.5 font-semibold text-status-declined">
                <AlertTriangle size={13} /> Not enough available for this date
              </p>
              {conflicts.map((c) => (
                <p key={c.equipmentId}>
                  {nameOf(c.equipmentId)}: {c.requested} needed, {Math.max(0, c.available)} free
                  {c.conflictingEvents.length ? ` (booked on ${c.conflictingEvents.map((e) => e.title ?? "another event").join(", ")})` : ""}.
                </p>
              ))}
              <p className="text-muted">Lower the quantity, pick other gear, or assign anyway if you&rsquo;ll cover it another way.</p>
            </div>
          )}
          {error && <p className="text-xs text-status-declined">{error}</p>}
          <div className="flex flex-wrap items-center justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {conflicts && conflicts.length > 0 ? (
              <Button variant="destructive" onClick={() => void confirm(true)} disabled={busy}>
                {busy && <Loader2 size={14} className="animate-spin" />} Assign anyway
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void confirm(false)} disabled={busy || chosen.length === 0}>
                {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Check availability &amp; confirm ({chosen.length})
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
