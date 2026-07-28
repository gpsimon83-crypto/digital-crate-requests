"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";

interface EventRow {
  id: string;
  title: string;
  status: string;
  starts_at: string | null;
  quoted_amount: number | null;
  final_amount: number | null;
  paid_cents: number;
  clients: { company_name: string | null; first_name: string | null; last_name: string | null } | null;
}

function clientName(c: EventRow["clients"]) {
  if (!c) return "No client";
  return c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || "Unnamed client";
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function AdminFinancePage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/events");
      const data = await res.json();
      setEvents(res.ok ? data.events : []);
    }
    load();
  }, []);

  const billable = useMemo(
    () => (events ?? []).filter((e) => e.status !== "inquiry" && e.status !== "declined"),
    [events]
  );

  const totals = useMemo(() => {
    let quotedCents = 0;
    let paidCents = 0;
    for (const e of billable) {
      quotedCents += Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100);
      paidCents += e.paid_cents;
    }
    return { quotedCents, paidCents, outstandingCents: quotedCents - paidCents };
  }, [billable]);

  const outstanding = billable
    .filter((e) => Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100) - e.paid_cents > 0)
    .sort((a, b) => new Date(a.starts_at ?? 0).getTime() - new Date(b.starts_at ?? 0).getTime());

  return (
    <>
      <PageHeader title="Finance" subtitle="Booking value, payments collected, and what's still outstanding." />
      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <GlassCard>
            <p className="text-xs text-muted">Total booked value</p>
            <p className="mt-1 text-2xl font-semibold">{events === null ? "..." : money(totals.quotedCents)}</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs text-muted">Collected</p>
            <p className="mt-1 text-2xl font-semibold text-status-approved">
              {events === null ? "..." : money(totals.paidCents)}
            </p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs text-muted">Outstanding</p>
            <p className="mt-1 text-2xl font-semibold text-gold">
              {events === null ? "..." : money(totals.outstandingCents)}
            </p>
          </GlassCard>
        </div>

        <GlassCard className="p-0">
          <p className="p-5 pb-0 text-sm font-semibold">Outstanding balances</p>
          <div className="flex flex-col divide-y divide-border">
            {events === null && <p className="p-5 text-sm text-muted">Loading...</p>}
            {events !== null && outstanding.length === 0 && (
              <p className="p-5 text-sm text-muted">Nothing outstanding — every booked event is paid in full.</p>
            )}
            {outstanding.map((e) => {
              const total = Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100);
              const balance = total - e.paid_cents;
              return (
                <Link
                  key={e.id}
                  href="/admin/events"
                  className="group flex items-center justify-between gap-4 px-5 py-3.5"
                >
                  <div>
                    <p className="text-sm font-medium group-hover:text-gold">{e.title}</p>
                    <p className="text-xs text-muted">
                      {clientName(e.clients)}
                      {e.starts_at ? ` · ${new Date(e.starts_at).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{money(balance)} due</p>
                    <p className="text-xs text-muted">
                      {money(e.paid_cents)} of {money(total)} paid
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </GlassCard>
      </div>
    </>
  );
}
