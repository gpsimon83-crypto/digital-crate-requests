"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { EmptyState } from "@/components/ui/empty-state";
import { Wallet, CheckCircle2, Clock } from "lucide-react";

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

  const loading = events === null;

  return (
    <>
      <PageHeader title="Finance" subtitle="Booking value, payments collected, and what's still outstanding." />
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap border border-border">
          <StatTile icon={Wallet} label="Total booked value" value={loading ? "…" : money(totals.quotedCents)} />
          <StatTile icon={CheckCircle2} label="Collected" value={loading ? "…" : money(totals.paidCents)} />
          <StatTile icon={Clock} label="Outstanding" value={loading ? "…" : money(totals.outstandingCents)} tone={totals.outstandingCents > 0 ? "urgent" : "default"} />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold">Outstanding balances</p>
          {loading && <p className="text-sm text-muted">Loading…</p>}
          {!loading && outstanding.length === 0 && (
            <EmptyState icon={CheckCircle2} title="Nothing outstanding" body="Every booked event is paid in full." />
          )}
          {outstanding.length > 0 && (
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Project</th>
                    <th>Contact</th>
                    <th>Date</th>
                    <th>Paid</th>
                    <th>Balance Due</th>
                  </tr>
                </thead>
                <tbody>
                  {outstanding.map((e) => {
                    const total = Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100);
                    const balance = total - e.paid_cents;
                    return (
                      <tr key={e.id} className="is-linked" onClick={() => (window.location.href = `/admin/events/${e.id}`)}>
                        <td>
                          <Link href={`/admin/events/${e.id}`} className="font-medium hover:text-gold hover:underline">
                            {e.title}
                          </Link>
                        </td>
                        <td className="text-muted">{clientName(e.clients)}</td>
                        <td className="whitespace-nowrap tabular-nums text-muted">
                          {e.starts_at ? new Date(e.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "—"}
                        </td>
                        <td className="tabular-nums text-muted">
                          {money(e.paid_cents)} / {money(total)}
                        </td>
                        <td className="font-semibold tabular-nums">{money(balance)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
