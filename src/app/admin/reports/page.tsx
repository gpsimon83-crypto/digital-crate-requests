"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Percent, Trophy, XCircle } from "lucide-react";

interface EventRow {
  id: string;
  title: string;
  status: string;
  starts_at: string | null;
  quoted_amount: number | null;
  final_amount: number | null;
  paid_cents: number;
  event_type: string | null;
  djs: { display_name: string } | null;
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

const MONTH_LABELS = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString(undefined, { month: "short" })
);

export default function AdminReportsPage() {
  const [events, setEvents] = useState<EventRow[] | null>(null);

  useEffect(() => {
    async function load() {
      const res = await fetch("/api/admin/events");
      const data = await res.json();
      setEvents(res.ok ? data.events : []);
    }
    load();
  }, []);

  const year = new Date().getFullYear();

  const stats = useMemo(() => {
    const all = events ?? [];
    const decided = all.filter((e) => e.status === "confirmed" || e.status === "live" || e.status === "ended" || e.status === "declined");
    const won = decided.filter((e) => e.status !== "declined");
    const conversionRate = decided.length ? Math.round((won.length / decided.length) * 100) : 0;

    const monthlyRevenueCents = Array(12).fill(0) as number[];
    for (const e of won) {
      if (!e.starts_at) continue;
      const d = new Date(e.starts_at);
      if (d.getFullYear() !== year) continue;
      monthlyRevenueCents[d.getMonth()] += Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100);
    }
    const maxMonth = Math.max(1, ...monthlyRevenueCents);

    const byDj = new Map<string, { count: number; cents: number }>();
    for (const e of won) {
      const name = e.djs?.display_name ?? "Unassigned";
      const entry = byDj.get(name) ?? { count: 0, cents: 0 };
      entry.count += 1;
      entry.cents += Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100);
      byDj.set(name, entry);
    }
    const djLeaderboard = [...byDj.entries()].sort((a, b) => b[1].cents - a[1].cents);

    const byType = new Map<string, number>();
    for (const e of won) {
      const type = e.event_type || "Other";
      byType.set(type, (byType.get(type) ?? 0) + 1);
    }
    const typeBreakdown = [...byType.entries()].sort((a, b) => b[1] - a[1]);

    return { conversionRate, wonCount: won.length, declinedCount: decided.length - won.length, monthlyRevenueCents, maxMonth, djLeaderboard, typeBreakdown };
  }, [events, year]);

  const loading = events === null;

  return (
    <>
      <PageHeader title="Reports" subtitle="Booking performance and revenue trends." />
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap border border-border">
          <StatTile icon={Percent} label="Lead conversion rate" value={loading ? "…" : `${stats.conversionRate}%`} />
          <StatTile icon={Trophy} label="Events won" value={loading ? "…" : stats.wonCount} />
          <StatTile icon={XCircle} label="Events declined" value={loading ? "…" : stats.declinedCount} tone={stats.declinedCount > 0 ? "urgent" : "default"} />
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold border-b border-border pb-2">Revenue by month — {year}</p>
          <div className="flex items-end gap-2 sm:gap-3">
            {stats.monthlyRevenueCents.map((cents, i) => (
              <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
                <div className="flex h-32 w-full items-end">
                  <div
                    className="w-full bg-gold/70"
                    style={{ height: `${Math.max(2, (cents / stats.maxMonth) * 100)}%` }}
                    title={money(cents)}
                  />
                </div>
                <span className="text-[10px] text-muted">{MONTH_LABELS[i]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold border-b border-border pb-2">DJ leaderboard</p>
            <div className="flex flex-col divide-y divide-border">
              {loading && <p className="py-2 text-sm text-muted">Loading...</p>}
              {!loading && stats.djLeaderboard.length === 0 && (
                <p className="py-2 text-sm text-muted">No booked events yet.</p>
              )}
              {stats.djLeaderboard.map(([name, entry]) => (
                <div key={name} className="flex items-center justify-between py-2.5 first:pt-0">
                  <span className="text-sm">{name}</span>
                  <span className="text-sm text-muted">
                    {entry.count} event{entry.count === 1 ? "" : "s"} · {money(entry.cents)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold border-b border-border pb-2">Event types</p>
            <div className="flex flex-col divide-y divide-border">
              {loading && <p className="py-2 text-sm text-muted">Loading...</p>}
              {!loading && stats.typeBreakdown.length === 0 && (
                <p className="py-2 text-sm text-muted">No booked events yet.</p>
              )}
              {stats.typeBreakdown.map(([type, count]) => (
                <div key={type} className="flex items-center justify-between py-2.5 first:pt-0">
                  <span className="text-sm capitalize">{type}</span>
                  <span className="text-sm text-muted">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
