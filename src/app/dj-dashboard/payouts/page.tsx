"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { ActionPanel, Col, Grid, MetricRow, MetricTile, PageShell, SectionCard } from "@/components/layout/grid";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { DollarSign, Clock, CheckCircle2 } from "lucide-react";

interface PayoutRow {
  id: string;
  amount_cents: number;
  status: "pending" | "paid";
  paid_at: string | null;
  notes: string | null;
  events: { title: string | null; starts_at: string | null } | null;
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}


export default function DjPayoutsPage() {
  const [payouts, setPayouts] = useState<PayoutRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    fetch("/api/dj/payouts")
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load payouts");
        setPayouts(data.payouts ?? []);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }

  useEffect(load, []);

  const pending = (payouts ?? []).filter((p) => p.status === "pending");
  const paid = (payouts ?? []).filter((p) => p.status === "paid");
  const pendingCents = pending.reduce((s, p) => s + p.amount_cents, 0);
  const paidCents = paid.reduce((s, p) => s + p.amount_cents, 0);

  const year = new Date().getFullYear();
  const paidThisYear = paid.filter((p) => p.paid_at && new Date(p.paid_at).getFullYear() === year).reduce((s, p) => s + p.amount_cents, 0);
  const busy = payouts === null && !error;

  return (
    <div className="min-h-dvh bg-background">
      <PageHeader breadcrumbs={[{ label: "Account" }, { label: "My Earnings" }]} title="My Earnings" subtitle="Your agreed pay for each gig: what's still to come and what's been paid." />
      <PageShell className="flex flex-col gap-4 xl:gap-5">
        {error && <GlassCard className="text-sm text-status-declined">{error}</GlassCard>}
        <MetricRow cols={3}>
          <MetricTile icon={Clock} label="Pending" value={busy ? "…" : money(pendingCents)} hint={busy ? undefined : `${pending.length} ${pending.length === 1 ? "gig" : "gigs"}`} tone={pendingCents > 0 ? "gold" : "default"} />
          <MetricTile icon={CheckCircle2} label={`Paid in ${year}`} value={busy ? "…" : money(paidThisYear)} />
          <MetricTile icon={DollarSign} label="Paid to date" value={busy ? "…" : money(paidCents)} hint={busy ? undefined : `${paid.length} ${paid.length === 1 ? "payout" : "payouts"}`} />
        </MetricRow>
        <Grid>
          <Col span={8}>
            <SectionCard title="Payout records" description="One line per gig, newest first.">
              {busy && <p className="text-sm text-muted">Loading...</p>}
              {payouts !== null && payouts.length === 0 && !error && (
                <EmptyState icon={DollarSign} title="No payouts yet" body="Payouts for your events will show up here once your admin adds them." />
              )}
              {payouts !== null && payouts.length > 0 && (
                <div className="-mx-1 overflow-x-auto px-1">
                  <table className="w-full min-w-[520px] text-sm">
                    <caption className="sr-only">Your payouts</caption>
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted">
                        <th scope="col" className="py-2 pr-3 font-semibold">Gig</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">Gig date</th>
                        <th scope="col" className="py-2 pr-3 font-semibold">Paid on</th>
                        <th scope="col" className="py-2 pr-3 text-right font-semibold">Amount</th>
                        <th scope="col" className="py-2 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {payouts.map((p) => (
                        <tr key={p.id}>
                          <td className="py-3 pr-3">
                            <span className="font-medium">{p.events?.title ?? "Event"}</span>
                            {p.notes && <span className="block text-xs text-muted">{p.notes}</span>}
                          </td>
                          <td className="whitespace-nowrap py-3 pr-3 text-muted">{p.events?.starts_at ? new Date(p.events.starts_at).toLocaleDateString() : "—"}</td>
                          <td className="whitespace-nowrap py-3 pr-3 text-muted">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}</td>
                          <td className="py-3 pr-3 text-right font-semibold tabular-nums">{money(p.amount_cents)}</td>
                          <td className="py-3">
                            <StatusChip tone={p.status === "paid" ? "approved" : "pending"}>{p.status === "paid" ? "Paid" : "Pending"}</StatusChip>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </Col>
          <Col span={4}>
            <ActionPanel title="How pay works">
              <p className="text-sm text-muted">The office adds your agreed pay to each gig. It shows as Pending until it&apos;s sent, then Paid with the date.</p>
              <p className="text-sm text-muted">Something look wrong? Message the office from the booking.</p>
            </ActionPanel>
          </Col>
        </Grid>
      </PageShell>
    </div>
  );
}
