"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type Activation = { id: string; scope: "company" | "venue" | "event"; venue_id: string | null; event_id: string | null; template_id: string };
export type UpcomingEvent = { id: string; title: string | null; starts_at: string | null; venue_id: string | null; venue_name: string | null };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "America/Chicago" }) : "");
const btn = "inline-flex h-8 items-center gap-1 rounded-[8px] border border-black/12 px-2.5 text-xs hover:border-gold disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";

/** Where a template is active, as short labels. */
export function activeLabels(templateId: string, acts: Activation[], venues: { id: string; name: string }[], events: UpcomingEvent[]): string[] {
  return acts
    .filter((a) => a.template_id === templateId)
    .map((a) =>
      a.scope === "company"
        ? "Company default"
        : a.scope === "venue"
          ? `Default for ${venues.find((v) => v.id === a.venue_id)?.name ?? "a venue"}`
          : `Event: ${(() => {
              const e = events.find((x) => x.id === a.event_id);
              return e ? [when(e.starts_at), e.title ?? e.venue_name].filter(Boolean).join(" ") : "an event";
            })()}`
    );
}

/**
 * "Activate" for one published template: company default, a venue's
 * default, or one event's override. New flyers pick the active template
 * (event → venue → company). Existing drafts change only if you then
 * choose to apply it to them; exported flyers never change.
 */
export function ActivateMenu({ templateId, templateName, defaultVenueId, venues, events, acts, ready, onChanged }: { templateId: string; templateName: string; defaultVenueId: string | null; venues: { id: string; name: string }[]; events: UpcomingEvent[]; acts: Activation[]; ready: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [scope, setScope] = useState<"company" | "venue" | "event">(defaultVenueId ? "venue" : "company");
  const [venueId, setVenueId] = useState(defaultVenueId ?? "");
  const [eventId, setEventId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [offer, setOffer] = useState<number | null>(null);
  const mine = acts.filter((a) => a.template_id === templateId);

  async function activate() {
    setBusy(true);
    setMsg(null);
    setOffer(null);
    const r = await fetch("/api/admin/flyers/activations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope, templateId, venueId: scope === "venue" ? venueId : undefined, eventId: scope === "event" ? eventId : undefined }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      setBusy(false);
      return setMsg(j.error ?? "Couldn't activate.");
    }
    const c = await fetch(`/api/admin/flyers/activations/apply?template=${templateId}`).then((x) => x.json()).catch(() => ({ drafts: 0 }));
    setBusy(false);
    setMsg("Activated. New flyers start from this template.");
    setOffer(c.drafts ?? 0);
    onChanged();
  }
  async function clear(a: Activation) {
    setBusy(true);
    const r = await fetch("/api/admin/flyers/activations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scope: a.scope, templateId: null, venueId: a.venue_id ?? undefined, eventId: a.event_id ?? undefined }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? "Couldn't remove.");
    onChanged();
  }
  async function apply() {
    if (!offer || !window.confirm(`Switch ${offer} draft flyer${offer === 1 ? "" : "s"} to “${templateName}”? Each keeps its own overrides (text or pictures someone changed by hand). Exported flyers are never changed.`)) return;
    setBusy(true);
    const r = await fetch("/api/admin/flyers/activations/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    setOffer(null);
    setMsg(r.ok ? `Updated ${j.applied} draft${j.applied === 1 ? "" : "s"}${j.skipped ? ` (${j.skipped} skipped: no layout in their size)` : ""}.` : (j.error ?? "Couldn't apply."));
  }

  if (!open)
    return (
      <button className={btn} onClick={() => setOpen(true)} disabled={!ready} title={ready ? undefined : "Needs migration 0052"}>
        <Zap size={13} /> Activate
      </button>
    );
  const field = "w-full rounded-[8px] border border-black/12 bg-white px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold";
  return (
    <div className="mt-2 flex w-full flex-col gap-2 rounded-[10px] border border-gold/40 bg-gold-soft/40 p-2.5 text-xs">
      <div className="flex gap-1" role="radiogroup" aria-label="Activate for">
        {(["company", "venue", "event"] as const).map((s) => (
          <button key={s} role="radio" aria-checked={scope === s} className={cn(btn, "flex-1 justify-center whitespace-nowrap px-1.5", scope === s && "border-gold bg-white font-semibold")} onClick={() => setScope(s)}>
            {s === "company" ? "Everyone" : s === "venue" ? "Venue" : "Event"}
          </button>
        ))}
      </div>
      {scope === "venue" && (
        <select className={field} value={venueId} onChange={(e) => setVenueId(e.target.value)} aria-label="Venue">
          <option value="">Choose a venue…</option>
          {venues.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      )}
      {scope === "event" && (
        <select className={field} value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Event">
          <option value="">Choose an event…</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {[when(e.starts_at), e.title, e.venue_name].filter(Boolean).join(" · ")}
            </option>
          ))}
        </select>
      )}
      <p className="text-[11px] text-muted">{scope === "company" ? "The default for every venue without its own." : scope === "venue" ? "Every event at this venue, unless the event has its own." : "Only this event."} Existing flyers don&apos;t change unless you choose to below.</p>
      <div className="flex gap-1.5">
        <button className={cn(btn, "border-gold bg-gold font-semibold text-[#1a140b]")} disabled={busy || (scope === "venue" && !venueId) || (scope === "event" && !eventId)} onClick={() => void activate()}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Activate
        </button>
        <button className={btn} onClick={() => setOpen(false)}>
          Close
        </button>
      </div>
      {msg && <p role="status">{msg}</p>}
      {offer !== null && offer > 0 && (
        <button className={btn} disabled={busy} onClick={() => void apply()}>
          Also switch {offer} existing draft{offer === 1 ? "" : "s"} to this template
        </button>
      )}
      {offer === 0 && <p className="text-[11px] text-muted">No existing drafts would change.</p>}
      {mine.length > 0 && (
        <div className="border-t border-black/10 pt-2">
          <p className="mb-1 font-semibold">Active for</p>
          <ul className="flex flex-col gap-1">
            {mine.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{activeLabels(templateId, [a], venues, events)[0]}</span>
                <button className="text-[11px] font-medium text-status-declined underline" disabled={busy} onClick={() => void clear(a)}>
                  Remove
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
