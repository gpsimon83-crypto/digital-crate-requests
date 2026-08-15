"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusChip } from "@/components/ui/status-chip";
import { ArrowLeft, DollarSign, Clock, CheckCircle2 } from "lucide-react";

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

function BackLink() {
  return (
    <Link
      href="/dj-dashboard"
      className="flex items-center gap-1.5 rounded-[10px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-black/25 hover:text-foreground"
    >
      <ArrowLeft size={14} /> Back
    </Link>
  );
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

  return (
    <div className="min-h-dvh bg-background">
      <PageHeader title="My Payouts" subtitle="What you're owed and what you've been paid, by event." action={<BackLink />} />
      <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-8 sm:px-8">
        {error && <GlassCard className="text-sm text-status-declined">{error}</GlassCard>}

        <div className="flex flex-wrap border border-border">
          <StatTile icon={Clock} label="Pending" value={payouts === null ? "…" : money(pendingCents)} tone={pendingCents > 0 ? "urgent" : "default"} />
          <StatTile icon={CheckCircle2} label="Paid to date" value={payouts === null ? "…" : money(paidCents)} />
        </div>

        {payouts === null && !error && <p className="text-sm text-muted">Loading...</p>}
        {payouts !== null && payouts.length === 0 && !error && (
          <EmptyState icon={DollarSign} title="No payouts yet" body="Payouts for your events will show up here once your admin adds them." />
        )}
        {payouts !== null && payouts.length > 0 && (
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {payouts.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{p.events?.title ?? "Event"}</p>
                  <p className="text-xs text-muted">
                    {p.events?.starts_at ? new Date(p.events.starts_at).toLocaleDateString() : "—"}
                    {p.notes && ` · ${p.notes}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3 text-xs">
                  <span className="font-semibold tabular-nums">{money(p.amount_cents)}</span>
                  <StatusChip tone={p.status === "paid" ? "approved" : "pending"}>{p.status === "paid" ? "Paid" : "Pending"}</StatusChip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
