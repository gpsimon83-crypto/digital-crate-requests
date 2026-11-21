"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Pin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BRIEF_FIELDS, fmtGigDate, RECAP_PROMPTS, type Brief } from "@/lib/residency";
import { cn } from "@/lib/utils";
import { GigChip } from "./residency-header";
import { api, errOf, type ResGig, type ResidencyData } from "./types";

const card = "rounded-[16px] border border-border bg-card/90 shadow-[var(--shadow-card)] backdrop-blur-sm";
const input = "w-full rounded-[10px] border border-border bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";
const HINTS: Record<string, string> = {
  load_in: "Arrive ~30 minutes before set via the main entrance.",
  house_gear: "In-house sound (mixer + tops). DJ brings controller and computer; XLR/RCA into the house system.",
  music: "High-energy, crowd-friendly mix: throwbacks, bar hits and current favorites. Read the room.",
  expectations: "Volume down during food service; announce last call at 4:45."
};

/** Standing instructions on the venue record, plus advice pinned from recaps. */
export function BriefTab({ data, onChanged }: { data: ResidencyData; onChanged: () => void }) {
  const [b, setB] = useState<Brief>(data.brief);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  if (!data.venue)
    return <p className={cn(card, "p-5 text-sm text-muted")}>Link a venue to this project (Details tab) to keep a standing brief on the venue record.</p>;
  const dirty = BRIEF_FIELDS.some((f) => (b[f.key] ?? "") !== (data.brief[f.key] ?? ""));
  async function save() {
    setBusy(true);
    const r = await api(`/api/admin/venues/${data.venue!.id}/brief`, "PATCH", { brief: b });
    setBusy(false);
    setMsg(r.ok ? "Saved. Every DJ on this venue sees it." : errOf(r.data));
    if (r.ok) onChanged();
  }
  async function unpin(id: string) {
    const r = await api(`/api/admin/venues/${data.venue!.id}/brief?pin=${id}`, "DELETE");
    if (r.ok) onChanged();
  }
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
      <section className={cn(card, "flex flex-col gap-4 p-5")} data-tour="brief-editor">
        <div>
          <h2 className="font-display text-[28px] leading-none">Venue brief</h2>
          <p className="mt-1 text-sm text-muted">Standing instructions for {data.venue.name}, kept on the venue record. The assigned DJ sees them before every gig, with that night&rsquo;s notes.</p>
        </div>
        {BRIEF_FIELDS.map((f) => (
          <label key={f.key} className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold uppercase tracking-[2.5px] text-foreground/75">{f.label}</span>
            <textarea value={b[f.key] ?? ""} onChange={(e) => setB({ ...b, [f.key]: e.target.value })} rows={3} maxLength={1500} placeholder={HINTS[f.key]} className={input} />
          </label>
        ))}
        <div className="flex items-center gap-3">
          <Button variant="primary" size="sm" disabled={busy || !dirty} onClick={() => void save()}>
            {busy && <Loader2 size={13} className="animate-spin" />} Save brief
          </Button>
          {msg && <span className="text-xs text-muted">{msg}</span>}
        </div>
      </section>
      <section className={cn(card, "flex flex-col gap-3 p-5")}>
        <h2 className="font-display text-[24px] leading-none">Pinned from recaps</h2>
        <p className="text-sm text-muted">Advice that keeps coming up. Pin it from any recap; the dated recap stays as the DJ wrote it.</p>
        {data.pins.length ? (
          <ul className="flex flex-col gap-2">
            {data.pins.map((p) => (
              <li key={p.id} className="flex items-start gap-2 rounded-[12px] border border-border bg-panel/60 p-3 text-sm">
                <Pin size={14} className="mt-0.5 shrink-0 text-gold" />
                <span className="flex-1">
                  {p.text}
                  {p.gig_date && <span className="mt-0.5 block text-xs text-muted">From the {fmtGigDate(p.gig_date)} recap</span>}
                </span>
                <button onClick={() => void unpin(p.id)} aria-label="Unpin" className="text-muted hover:text-status-declined">
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[12px] border border-dashed border-border p-4 text-sm text-muted">Nothing pinned yet.</p>
        )}
      </section>
    </div>
  );
}

/** Every submitted recap, newest first, and the played gigs still waiting on one. */
export function RecapsTab({ data, focusId, onOpenGig }: { data: ResidencyData; focusId: string | null; onOpenGig: (g: ResGig) => void }) {
  const due = data.gigs.filter((g) => g.outcome !== "canceled" && g.gig_date <= data.today && g.coverage === "confirmed" && !g.recapId);
  useEffect(() => {
    if (focusId) document.getElementById(`recap-${focusId}`)?.scrollIntoView({ block: "center" });
  }, [focusId]);
  return (
    <div className="flex flex-col gap-6">
      {due.length > 0 && (
        <section className={cn(card, "p-5")} data-tour="recaps-due">
          <h2 className="font-display text-[24px] leading-none">Waiting on a recap</h2>
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {due.map((g) => (
              <li key={g.id}>
                <button onClick={() => onOpenGig(g)} className="flex w-full flex-wrap items-center justify-between gap-2 py-2.5 text-left text-sm hover:text-gold">
                  <span>
                    {fmtGigDate(g.gig_date)} · {g.djName}
                  </span>
                  <GigChip status={g.status} className="text-xs" />
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">The DJ sees the recap questions in My Bookings once the gig starts.</p>
        </section>
      )}
      <section className="flex flex-col gap-4" aria-label="Recaps">
        {data.recaps.length === 0 && <p className={cn(card, "p-5 text-sm text-muted")}>No recaps yet. After each gig the DJ answers three quick questions and can flag an issue for staff.</p>}
        {data.recaps.map((r) => {
          const gig = data.gigs.find((g) => g.id === r.gig_id);
          return (
            <article key={r.id} id={`recap-${r.id}`} className={cn(card, "p-5", focusId === r.id && "ring-2 ring-gold")}>
              <header className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-display text-xl">{r.gig_date ? fmtGigDate(r.gig_date, { weekday: "long", month: "long", day: "numeric" }) : "Gig"}</h3>
                <p className="text-xs text-muted">
                  {r.djName ?? "DJ"} · sent {new Date(r.submitted_at).toLocaleDateString()}
                </p>
              </header>
              <dl className="mt-3 grid gap-3 sm:grid-cols-3">
                {RECAP_PROMPTS.map((p) => (
                  <div key={p.key}>
                    <dt className="text-[11px] font-semibold uppercase tracking-[2px] text-muted">{p.label}</dt>
                    <dd className="mt-1 text-sm">{r[p.key]}</dd>
                  </div>
                ))}
              </dl>
              {r.issue && (
                <p className={cn("mt-3 flex items-start gap-2 rounded-[10px] border p-3 text-sm", r.issue_resolved_at ? "border-border text-muted" : "border-status-pending/50 bg-status-pending/5")}>
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-status-pending" /> {r.issue} {r.issue_resolved_at ? "(resolved)" : ""}
                </p>
              )}
              {gig && (
                <button onClick={() => onOpenGig(gig)} className="mt-3 text-xs font-medium text-gold hover:underline">
                  Open the gig{r.issue && !r.issue_resolved_at ? " to resolve the issue" : " to pin advice"}
                </button>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
