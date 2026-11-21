"use client";

import { use as usePromise, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, Check, Clock, Loader2, MapPin, Phone, Pin, X } from "lucide-react";
import { BRIEF_FIELDS, fmtGigDate, type Brief } from "@/lib/residency";
import { cn } from "@/lib/utils";

type Detail = {
  gig: { id: string; date: string; hours: string; coverage: string; outcome: string; notes: string | null; changeNote: string | null; cancelReason: string | null };
  night: string;
  venue: { name: string; city: string | null; state: string | null; cover_url: string | null; address_line1?: string | null; contact_name?: string | null; contact_phone?: string | null } | null;
  brief: Brief;
  pins: { id: string; text: string }[];
  fromLastDjs: { text: string; at: string }[];
  recap: { picked_up: string; worked: string; next_dj: string; issue: string | null; submitted_at: string } | null;
  canRespond: boolean;
  canRecap: boolean;
  prompts: { key: "picked_up" | "worked" | "next_dj"; label: string; placeholder: string; max: number }[];
};

const card = "rounded-[16px] border border-border bg-card p-4";
const input = "w-full rounded-[10px] border border-border bg-panel px-3 py-2.5 text-[15px] focus:border-gold focus:outline-none";

/** The assigned DJ's page for one venue night: brief, this night's notes, confirm, and the recap after. */
export default function DjGigPage({ params }: { params: Promise<{ gigId: string }> }) {
  const { gigId } = usePromise(params);
  const [d, setD] = useState<Detail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [a, setA] = useState<Record<string, string>>({});
  const [flag, setFlag] = useState(false);
  const [issue, setIssue] = useState("");
  const load = useCallback(() => {
    fetch(`/api/dj/gigs/${gigId}`, { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => (ok ? setD(j) : setErr(j.error ?? "Couldn't load this gig.")))
      .catch(() => setErr("Couldn't load this gig."));
  }, [gigId]);
  useEffect(() => load(), [load]);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    setErr(null);
    const r = await fetch(`/api/dj/gigs/${gigId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Couldn't save that.");
    load();
  }

  if (!d) return <div className="mx-auto max-w-2xl px-4 py-8 text-sm">{err ? <p className="text-status-declined">{err}</p> : <p className="text-muted">Loading…</p>}</div>;
  const filled = BRIEF_FIELDS.filter((f) => d.brief[f.key]);
  const addr = [d.venue?.address_line1, d.venue?.city, d.venue?.state].filter(Boolean).join(", ");
  const ready = d.prompts.every((p) => a[p.key]?.trim()) && (!flag || issue.trim());

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-5 sm:px-6">
      <Link href="/dj-dashboard/bookings" className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground">
        <ArrowLeft size={15} /> My Bookings
      </Link>
      <header className="overflow-hidden rounded-[16px] border border-border bg-card">
        {d.venue?.cover_url && <div className="aspect-[16/6] bg-cover bg-center" style={{ backgroundImage: `url(${d.venue.cover_url})` }} role="img" aria-label={`${d.venue.name} photo`} />}
        <div className="p-4">
          <p className="text-[11px] font-semibold uppercase tracking-[2.5px] text-gold">{d.night}</p>
          <h1 className="mt-1 font-display text-3xl leading-tight">{d.venue?.name ?? "Venue"}</h1>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[15px]">
            <span className="flex items-center gap-1.5">
              <Clock size={15} className="text-gold" /> {fmtGigDate(d.gig.date, { weekday: "long", month: "long", day: "numeric" })} · {d.gig.hours}
            </span>
            {addr && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(addr)}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 underline decoration-border">
                <MapPin size={15} className="text-gold" /> {addr}
              </a>
            )}
          </p>
          {d.venue?.contact_phone && (
            <a href={`tel:${d.venue.contact_phone}`} className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm">
              <Phone size={13} /> {d.venue.contact_name ?? "Venue"} · {d.venue.contact_phone}
            </a>
          )}
        </div>
      </header>

      {err && <p className="text-sm text-status-declined">{err}</p>}
      {d.gig.outcome === "canceled" && <p className="rounded-[12px] border border-status-declined/40 bg-status-declined/5 p-3 text-sm">This date is canceled: {d.gig.cancelReason}</p>}
      {d.gig.changeNote && <p className="rounded-[12px] border border-status-pending/40 bg-status-pending/5 p-3 text-sm">{d.gig.changeNote}</p>}

      {d.canRespond && (
        <section className={cn(card, "flex flex-col gap-3 border-gold/40")}>
          <p className="text-sm">Can you cover this night?</p>
          <div className="flex gap-2">
            <button disabled={busy} onClick={() => void post({ action: "confirm" })} className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-status-approved px-4 py-3 text-sm font-bold text-black disabled:opacity-50">
              <Check size={15} /> Confirm
            </button>
            <button disabled={busy} onClick={() => void post({ action: "decline" })} className="flex flex-1 items-center justify-center gap-1.5 rounded-[10px] bg-status-declined px-4 py-3 text-sm font-bold text-white disabled:opacity-50">
              <X size={15} /> Decline
            </button>
          </div>
        </section>
      )}
      {d.gig.coverage === "confirmed" && d.gig.outcome === "scheduled" && !d.canRecap && <p className="flex items-center gap-1.5 text-sm text-status-approved"><Check size={15} /> You&rsquo;re confirmed for this night.</p>}

      {d.gig.notes && (
        <section className={cn(card, "border-gold/40")}>
          <h2 className="text-[11px] font-semibold uppercase tracking-[2.5px] text-gold">This night only</h2>
          <p className="mt-1 whitespace-pre-line text-[15px]">{d.gig.notes}</p>
        </section>
      )}

      <section className={card}>
        <h2 className="font-display text-2xl">Venue brief</h2>
        {filled.length ? (
          <dl className="mt-2">
            {filled.map((f) => (
              <div key={f.key} className="border-t border-border py-2.5">
                <dt className="text-[11px] font-semibold uppercase tracking-[2.5px] text-muted">{f.label}</dt>
                <dd className="mt-0.5 whitespace-pre-line text-[15px]">{d.brief[f.key]}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="mt-1 text-sm text-muted">No standing brief yet. Ask Digital Crate DJs if anything&rsquo;s unclear.</p>
        )}
        {d.pins.length > 0 && (
          <ul className="mt-2 flex flex-col gap-1.5 border-t border-border pt-3 text-sm">
            {d.pins.map((p) => (
              <li key={p.id} className="flex items-start gap-2">
                <Pin size={13} className="mt-1 shrink-0 text-gold" /> {p.text}
              </li>
            ))}
          </ul>
        )}
      </section>

      {d.fromLastDjs.length > 0 && (
        <section className={card}>
          <h2 className="text-[11px] font-semibold uppercase tracking-[2.5px] text-muted">From the last DJs here</h2>
          <ul className="mt-2 flex flex-col gap-2 text-sm">
            {d.fromLastDjs.map((p, i) => (
              <li key={i}>
                &ldquo;{p.text}&rdquo; <span className="text-xs text-muted">· {new Date(p.at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {d.canRecap && (
        <section className={cn(card, "flex flex-col gap-3 border-gold/40")} data-tour="dj-recap">
          <h2 className="font-display text-2xl">Quick recap</h2>
          {d.prompts.map((p) => (
            <label key={p.key} className="flex flex-col gap-1">
              <span className="text-sm font-medium">{p.label}</span>
              <textarea value={a[p.key] ?? ""} onChange={(e) => setA({ ...a, [p.key]: e.target.value })} rows={2} maxLength={p.max} placeholder={p.placeholder} className={input} />
            </label>
          ))}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={flag} onChange={(e) => setFlag(e.target.checked)} className="mt-1 h-4 w-4 accent-[var(--gold)]" />
            <span>
              Flag an issue for staff to follow up
              <span className="block text-xs text-muted">Payment, gear, venue staff, safety: anything someone should handle.</span>
            </span>
          </label>
          {flag && <textarea value={issue} onChange={(e) => setIssue(e.target.value)} rows={2} maxLength={1000} placeholder="What happened?" className={input} aria-label="The issue" />}
          <button disabled={busy || !ready} onClick={() => void post({ action: "recap", recap: { ...a, issue: flag ? issue : null } })} className="flex items-center justify-center gap-1.5 rounded-[12px] bg-gold px-4 py-3 text-sm font-bold text-[var(--on-gold,#1a140a)] disabled:opacity-50">
            {busy && <Loader2 size={14} className="animate-spin" />} Send recap
          </button>
        </section>
      )}

      {d.recap && (
        <section className={card}>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-status-approved">
            <Check size={15} /> Recap sent {new Date(d.recap.submitted_at).toLocaleDateString()}
          </h2>
          <dl className="mt-2 flex flex-col gap-2 text-sm">
            {d.prompts.map((p) => (
              <div key={p.key}>
                <dt className="text-xs text-muted">{p.label}</dt>
                <dd>{d.recap![p.key]}</dd>
              </div>
            ))}
          </dl>
          {d.recap.issue && (
            <p className="mt-2 flex items-start gap-1.5 text-sm text-status-pending">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" /> Flagged for staff: {d.recap.issue}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
