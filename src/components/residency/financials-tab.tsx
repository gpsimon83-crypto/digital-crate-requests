"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PAYMENT_METHODS } from "@/lib/payment-methods";
import { fmtGigDate, type MonthSummary } from "@/lib/residency";
import { cn } from "@/lib/utils";
import { api, errOf, money } from "./types";

const card = "rounded-[16px] border border-border bg-card/90 shadow-[var(--shadow-card)] backdrop-blur-sm";

type Row = {
  id: string;
  gig_date: string;
  outcome: "scheduled" | "played" | "canceled";
  coverage: string;
  djName: string | null;
  venue_fee_cents: number | null;
  venue_paid_cents: number;
  dj_payout_cents: number | null;
  payout_status: string | null;
};
type Fin = { month: string; months: string[]; today: string; rates: { venue_fee_cents: number | null; dj_payout_cents: number | null; money_notes: string | null }; canManage: boolean; summary: MonthSummary; gigs: Row[] };

const monthName = (m: string) => new Date(`${m}-15T12:00:00Z`).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const shift = (m: string, n: number) => {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(Date.UTC(y, mo - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

/** Staff with finance access: one month of gigs, coverage, venue payments and DJ payouts. */
export function FinancialsTab({ eventId, ledger }: { eventId: string; ledger: React.ReactNode }) {
  const [month, setMonth] = useState<string | null>(null);
  const [d, setD] = useState<Fin | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [method, setMethod] = useState("check");
  const load = useCallback(() => {
    fetch(`/api/admin/events/${eventId}/residency/financials${month ? `?month=${month}` : ""}`, { cache: "no-store" })
      .then((r) => r.json().then((j) => ({ ok: r.ok, j })))
      .then(({ ok, j }) => (ok ? (setD(j), setErr(null)) : setErr(j.error ?? "Couldn't load.")))
      .catch(() => setErr("Couldn't load."));
  }, [eventId, month]);
  useEffect(() => load(), [load]);

  async function act(gigId: string, body: Record<string, unknown>) {
    setBusy(gigId + body.action);
    const r = await api(`/api/admin/events/${eventId}/residency/gigs/${gigId}`, "PATCH", body);
    setBusy(null);
    if (!r.ok) setErr(errOf(r.data));
    load();
  }

  if (!d) return <p className={cn(card, "p-5 text-sm", err ? "text-status-declined" : "text-muted")}>{err ?? "Loading…"}</p>;
  const s = d.summary;
  const tiles = [
    { label: "Gigs", value: `${s.scheduled + s.played}`, sub: `${s.played} played · ${s.scheduled} scheduled · ${s.canceled} canceled` },
    { label: "DJ coverage", value: `${s.coverage.confirmed}/${s.coverage.confirmed + s.coverage.awaiting + s.coverage.unassigned}`, sub: `${s.coverage.awaiting} awaiting · ${s.coverage.unassigned} unassigned` },
    { label: "Venue owes", value: money(s.venueOutstandingCents), sub: `${money(s.venuePaidCents)} paid of ${money(s.venueDueCents)} for played gigs`, warn: s.venueOutstandingCents > 0 },
    { label: "Payouts owed", value: money(s.payoutOutstandingCents), sub: `${money(s.payoutPaidCents)} paid of ${money(s.payoutDueCents)}`, warn: s.payoutOutstandingCents > 0 }
  ];
  return (
    <div className="flex flex-col gap-6" data-tour="residency-financials">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1">
          <button onClick={() => setMonth(shift(d.month, -1))} aria-label="Previous month" className="rounded-[10px] border border-border p-2 hover:border-gold">
            <ChevronLeft size={16} />
          </button>
          <h2 className="min-w-[11rem] text-center font-display text-2xl">{monthName(d.month)}</h2>
          <button onClick={() => setMonth(shift(d.month, 1))} aria-label="Next month" className="rounded-[10px] border border-border p-2 hover:border-gold">
            <ChevronRight size={16} />
          </button>
        </div>
        <p className="text-xs text-muted">
          Standing rates: venue {money(d.rates.venue_fee_cents)} · DJ {money(d.rates.dj_payout_cents)} per gig. Staff only; never shown in the venue or client portal.
        </p>
      </div>
      {err && <p className="text-sm text-status-declined">{err}</p>}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label} className={cn(card, "p-4")}>
            <p className="text-[11px] font-semibold uppercase tracking-[2px] text-muted">{t.label}</p>
            <p className={cn("mt-1 font-display text-3xl", t.warn && "text-status-pending")}>{t.value}</p>
            <p className="mt-1 text-xs text-muted">{t.sub}</p>
          </div>
        ))}
      </div>
      <section className={cn(card, "overflow-x-auto")}>
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-[2px] text-muted">
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">DJ</th>
              <th className="px-4 py-3 font-semibold">Gig</th>
              <th className="px-4 py-3 font-semibold">Venue payment</th>
              <th className="px-4 py-3 font-semibold">DJ payout</th>
            </tr>
          </thead>
          <tbody>
            {d.gigs.map((g) => {
              const fee = g.venue_fee_cents ?? 0;
              const venueDone = g.outcome === "played" && fee > 0 && g.venue_paid_cents >= fee;
              return (
                <tr key={g.id} className={cn("border-t border-border", g.outcome === "canceled" && "text-muted")}>
                  <td className="px-4 py-3">{fmtGigDate(g.gig_date)}</td>
                  <td className="px-4 py-3">{g.djName ?? "—"}</td>
                  <td className="px-4 py-3 capitalize">{g.outcome}</td>
                  <td className="px-4 py-3">
                    {g.outcome !== "played" ? (
                      <span className="text-muted">{g.outcome === "canceled" ? "—" : money(g.venue_fee_cents)}</span>
                    ) : venueDone ? (
                      <span className="text-gold">Paid {money(g.venue_paid_cents)}</span>
                    ) : (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-status-pending">{fee ? `${money(fee - g.venue_paid_cents)} due` : "No rate set"}</span>
                        {d.canManage && fee > 0 && (
                          <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => void act(g.id, { action: "venue_paid", method })}>
                            {busy === g.id + "venue_paid" && <Loader2 size={12} className="animate-spin" />} Mark paid
                          </Button>
                        )}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {g.outcome !== "played" || !g.djName ? (
                      <span className="text-muted">{g.outcome === "canceled" ? "—" : money(g.dj_payout_cents)}</span>
                    ) : g.payout_status === "paid" ? (
                      <span className="text-gold">Paid {money(g.dj_payout_cents)}</span>
                    ) : (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-status-pending">{g.dj_payout_cents ? `${money(g.dj_payout_cents)} owed` : "No payout set"}</span>
                        {d.canManage && !!g.dj_payout_cents && (
                          <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => void act(g.id, { action: "payout", status: "paid" })}>
                            Mark paid
                          </Button>
                        )}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {!d.gigs.length && (
              <tr>
                <td colSpan={5} className="px-4 py-5 text-muted">
                  No gigs this month.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {d.canManage && (
          <p className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3 text-xs text-muted">
            Venue payments are recorded as
            <select value={method} onChange={(e) => setMethod(e.target.value)} className="rounded-[8px] border border-border bg-panel px-2 py-1 text-xs" aria-label="Payment method">
              {Object.entries(PAYMENT_METHODS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l}
                </option>
              ))}
            </select>
            . DJ payouts also appear on Finance → Payouts and in the DJ&rsquo;s own payouts.
          </p>
        )}
      </section>
      {d.rates.money_notes && (
        <section className={cn(card, "p-4 text-sm")}>
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-muted">Negotiation notes</p>
          <p className="mt-1 whitespace-pre-line">{d.rates.money_notes}</p>
        </section>
      )}
      <div className={cn(card, "p-5")}>{ledger}</div>
    </div>
  );
}
