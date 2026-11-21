"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, X, Repeat2, MapPin, ClipboardPen, ArrowRight } from "lucide-react";
import { GlassCard } from "@/components/ui/glass-card";
import { fmtGigDate, fmtHours } from "@/lib/residency";

type G = { id: string; date: string; start: string; end: string; night: string; venue: string | null; place: string | null; notes: string | null; changeNote: string | null };
type Data = { awaiting: G[]; upcoming: G[]; recapDue: G[] };

function Info({ g }: { g: G }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[2px] text-gold">
        <Repeat2 size={12} /> {g.night}
      </p>
      <p className="mt-1 text-base font-semibold">
        {fmtGigDate(g.date, { weekday: "long", month: "short", day: "numeric" })} · {fmtHours(g.start, g.end)}
      </p>
      {g.venue && (
        <p className="mt-0.5 flex items-center gap-1 text-sm text-muted">
          <MapPin size={13} /> {g.venue}
          {g.place ? `, ${g.place}` : ""}
        </p>
      )}
      {g.changeNote && <p className="mt-1 text-xs text-status-pending">{g.changeNote}</p>}
      {g.notes && <p className="mt-1 text-xs text-muted">Note for this night: {g.notes}</p>}
    </div>
  );
}

/**
 * Recurring venue nights in My Bookings, alongside one-off events: dates to
 * confirm (same Confirm / Decline as events), confirmed dates, and recaps due.
 */
export function DjGigsSections() {
  const [d, setD] = useState<Data | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => {
    fetch("/api/dj/gigs", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setD(j))
      .catch(() => setD(null));
  }, []);
  useEffect(() => load(), [load]);
  async function respond(id: string, action: "confirm" | "decline") {
    setActing(id);
    setErr(null);
    const r = await fetch(`/api/dj/gigs/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (!r.ok) setErr((await r.json().catch(() => ({}))).error ?? "Couldn't save that.");
    setActing(null);
    load();
  }
  if (!d || (!d.awaiting.length && !d.upcoming.length && !d.recapDue.length)) return null;
  return (
    <section className="flex flex-col gap-3" data-tour="dj-venue-nights">
      <h2 className="text-xs font-bold uppercase tracking-[2px] text-muted">Venue nights</h2>
      {err && <p className="text-sm text-status-declined">{err}</p>}
      {d.recapDue.map((g) => (
        <GlassCard key={g.id} className="flex flex-col gap-3 border-gold/40 sm:flex-row sm:items-center sm:justify-between">
          <Info g={g} />
          <Link href={`/dj-dashboard/gigs/${g.id}`} className="inline-flex shrink-0 items-center gap-1.5 rounded-[10px] bg-gold px-4 py-2.5 text-xs font-bold text-[var(--on-gold,#1a140a)]">
            <ClipboardPen size={14} /> Send recap
          </Link>
        </GlassCard>
      ))}
      {d.awaiting.map((g) => (
        <GlassCard key={g.id} neon className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Info g={g} />
          <div className="flex shrink-0 flex-wrap gap-2">
            <Link href={`/dj-dashboard/gigs/${g.id}`} className="flex items-center gap-1 rounded-[10px] border border-border px-3 py-2.5 text-xs hover:border-gold">
              Brief <ArrowRight size={12} />
            </Link>
            <button disabled={acting === g.id} onClick={() => respond(g.id, "confirm")} className="flex items-center gap-1.5 rounded-[10px] bg-status-approved px-4 py-2.5 text-xs font-bold text-black transition-transform hover:scale-[1.02] disabled:opacity-50">
              <Check size={14} /> Confirm
            </button>
            <button disabled={acting === g.id} onClick={() => respond(g.id, "decline")} className="flex items-center gap-1.5 rounded-[10px] bg-status-declined px-4 py-2.5 text-xs font-bold text-white transition-transform hover:scale-[1.02] disabled:opacity-50">
              <X size={14} /> Decline
            </button>
          </div>
        </GlassCard>
      ))}
      {d.upcoming.map((g) => (
        <GlassCard key={g.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Info g={g} />
          <Link href={`/dj-dashboard/gigs/${g.id}`} className="inline-flex shrink-0 items-center gap-1 rounded-[10px] border border-border px-3 py-2 text-xs hover:border-gold">
            Venue brief <ArrowRight size={12} />
          </Link>
        </GlassCard>
      ))}
    </section>
  );
}
