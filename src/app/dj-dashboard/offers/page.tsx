"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, Clock, MapPin, Speaker, Wallet } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { PageShell, SectionCard } from "@/components/layout/grid";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { dollars } from "@/lib/payouts/rule";
import type { DjOffer } from "@/lib/data/offers";

const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric", timeZone: "America/Chicago" }) : "Date to be confirmed");
const fmtDay = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
const fmtTime = (t: string | null | undefined) => {
  if (!t) return null;
  const [h, m] = t.split(":").map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

const STATE: Record<string, { label: string; tone: string }> = {
  offered: { label: "Offered", tone: "border-gold/60 text-gold" },
  accepted: { label: "Accepted", tone: "border-status-approved/50 text-status-approved" },
  paid: { label: "Paid", tone: "border-status-approved/50 bg-status-approved/10 text-status-approved" },
  declined: { label: "Declined", tone: "border-border text-muted" },
  superseded: { label: "Replaced", tone: "border-border text-muted" }
};

/** The DJ's gig offers: the exact payout and what's expected, before they accept. */
export default function DjOffersPage() {
  const [offers, setOffers] = useState<DjOffer[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(
    () =>
      fetch("/api/dj/offers", { cache: "no-store" })
        .then(async (r) => {
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || "Couldn't load offers");
          setOffers(j.offers ?? []);
        })
        .catch((e) => setErr(e instanceof Error ? e.message : "Couldn't load offers")),
    []
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function answer(o: DjOffer, action: "accept" | "decline") {
    setBusy(o.id);
    setErr(null);
    try {
      const r = await fetch(`/api/dj/offers/${o.id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || "Couldn't send your answer");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(null);
    }
  }

  const open = (offers ?? []).filter((o) => o.status === "offered");
  const rest = (offers ?? []).filter((o) => o.status !== "offered");

  return (
    <>
      <PageHeader title="Gig Offers" subtitle="Your payout and what's expected, before you say yes. Accepting saves the payout as agreed." />
      <PageShell narrow className="flex flex-col gap-5">
        {err && (
          <p role="alert" className="rounded-[10px] border border-status-declined/40 px-3 py-2 text-sm text-status-declined">
            {err}
          </p>
        )}
        {offers === null && !err && <p className="text-sm text-muted">Loading…</p>}
        {offers && offers.length === 0 && <p className="text-sm text-muted">No offers right now. New ones show up here and in your notifications.</p>}
        {open.length > 0 && (
          <section aria-label="Waiting for your answer" className="flex flex-col gap-4">
            {open.map((o) => (
              <OfferCard key={o.id} o={o} busy={busy === o.id} onAnswer={(a) => answer(o, a)} />
            ))}
          </section>
        )}
        {rest.length > 0 && (
          <SectionCard title="Earlier offers">
            <ul className="flex flex-col gap-3">
              {rest.map((o) => (
                <OfferCard key={o.id} o={o} compact />
              ))}
            </ul>
          </SectionCard>
        )}
        <p className="text-xs text-muted">
          Paid amounts show in <Link href="/dj-dashboard/payouts" className="text-gold hover:underline">My Earnings</Link>. Tips are separate and always yours.
        </p>
      </PageShell>
    </>
  );
}

function OfferCard({ o, busy, onAnswer, compact }: { o: DjOffer; busy?: boolean; onAnswer?: (a: "accept" | "decline") => void; compact?: boolean }) {
  const state = o.status === "accepted" && o.payment === "paid" ? "paid" : o.status;
  const s = o.scope;
  const times = [s.arrival && `Arrive ${fmtTime(s.arrival)}`, s.start && `Play ${fmtTime(s.start)}${s.end ? `–${fmtTime(s.end)}` : ""}`].filter(Boolean).join(" · ");
  const Wrap = compact ? "li" : "article";
  return (
    <Wrap className={cn("flex flex-col gap-3", compact ? "rounded-[12px] border border-border p-4" : "glass-card p-5 sm:p-6")} data-dj-offer={o.status}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted">{o.event.type ?? "Gig"}{o.version > 1 && " · Revised offer"}</p>
          <h2 className="break-words text-lg font-semibold leading-snug">{o.event.title}</h2>
        </div>
        <span className={cn("rounded-full border px-2.5 py-0.5 text-xs font-medium", STATE[state].tone)}>{STATE[state].label}</span>
      </div>

      <div className="rounded-[12px] border border-gold/50 bg-gold/5 px-4 py-3" data-testid="your-payout">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">Your Payout</p>
        <p className="text-2xl font-semibold text-gold">
          {dollars(o.payoutCents)}
          {o.payoutPerDate && <span className="text-base font-normal text-muted"> per date</span>}
        </p>
        {o.payoutPerDate && o.dates.length > 0 && <p className="text-sm text-muted">{o.dates.length} dates · {dollars(o.totalCents)} in all</p>}
        {o.previousPayoutCents != null && o.previousPayoutCents !== o.payoutCents && <p className="text-sm text-muted">You had agreed to {dollars(o.previousPayoutCents)}. That stands unless you accept this revision.</p>}
        {o.status === "accepted" && <p className="mt-1 text-xs text-muted">{o.payment === "paid" ? "Paid." : "Agreed. Payment is pending."}</p>}
      </div>

      <ul className="grid gap-2 text-sm sm:grid-cols-2">
        <li className="flex gap-2">
          <CalendarDays size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
          {o.payoutPerDate ? (o.dates.length ? o.dates.map((d) => fmtDay(d.date)).join(", ") : "Dates to be confirmed") : fmtDate(o.event.startsAt)}
        </li>
        {(o.event.venue || o.event.venueCity) && (
          <li className="flex gap-2">
            <MapPin size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
            {[o.event.venue, o.event.venueCity].filter(Boolean).join(", ")}
          </li>
        )}
        {times && (
          <li className="flex gap-2">
            <Clock size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
            {times}
          </li>
        )}
        {s.equipment && (
          <li className="flex gap-2 sm:col-span-2">
            <Speaker size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
            <span className="whitespace-pre-wrap">{s.equipment}</span>
          </li>
        )}
        {(s.extras ?? []).length > 0 && (
          <li className="flex gap-2 sm:col-span-2">
            <Wallet size={16} aria-hidden className="mt-0.5 shrink-0 text-muted" />
            <span>Paid extras included: {(s.extras ?? []).map((x) => `${x.label} (${dollars(x.payoutCents)})`).join(", ")}</span>
          </li>
        )}
      </ul>
      {s.notes && <p className="whitespace-pre-wrap text-sm text-foreground/85">{s.notes}</p>}

      {onAnswer && o.status === "offered" && (
        <div className="flex flex-wrap gap-3">
          <Button variant="primary" disabled={busy} onClick={() => onAnswer("accept")}>
            {busy ? "Saving…" : `Accept for ${dollars(o.payoutPerDate ? o.totalCents : o.payoutCents)}`}
          </Button>
          <Button variant="secondary" disabled={busy} onClick={() => onAnswer("decline")}>
            Decline
          </Button>
        </div>
      )}
    </Wrap>
  );
}
