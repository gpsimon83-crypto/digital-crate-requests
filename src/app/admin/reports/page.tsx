"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatTile } from "@/components/ui/stat-tile";
import { Percent, Trophy, XCircle, Clock, DollarSign } from "lucide-react";

type ReportRange = "last_6_months" | "last_12_months" | "this_year" | "last_year" | "all_time";

const RANGE_OPTIONS: { value: ReportRange; label: string }[] = [
  { value: "last_6_months", label: "Last 6 Months" },
  { value: "last_12_months", label: "Last 12 Months" },
  { value: "this_year", label: "This Year" },
  { value: "last_year", label: "Last Year" },
  { value: "all_time", label: "All Time" }
];

interface RevenueMonth {
  month: string;
  bookedCents: number;
  collectedCents: number;
}

interface LeadSourceStat {
  source: string;
  total: number;
  won: number;
  lost: number;
  pending: number;
}

interface DjPerformance {
  djId: string;
  djName: string;
  gigs: number;
  revenueCents: number;
  avgDealCents: number;
}

interface EventTypeStat {
  type: string;
  count: number;
  revenueCents: number;
}

interface ReportsSummary {
  revenueTrend: RevenueMonth[];
  leadConversion: { total: number; won: number; lost: number; pending: number; bySource: LeadSourceStat[] };
  djPerformance: DjPerformance[];
  eventTypes: EventTypeStat[];
}

function money(cents: number) {
  const dollars = cents / 100;
  const sign = dollars < 0 ? "-" : "";
  return `${sign}$${Math.abs(dollars).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export default function AdminReportsPage() {
  const [range, setRange] = useState<ReportRange>("last_12_months");
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/reports?range=${range}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load reports");
        setSummary(data.summary);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }, [range]);

  const loading = summary === null && !error;
  const winRate = summary && summary.leadConversion.total > 0 ? Math.round((summary.leadConversion.won / summary.leadConversion.total) * 100) : 0;

  const maxMonthCents = summary ? Math.max(1, ...summary.revenueTrend.flatMap((m) => [m.bookedCents, m.collectedCents])) : 1;

  return (
    <>
      <PageHeader title="Reports" subtitle="Revenue trends, lead conversion, and DJ performance." />
      <div className="flex flex-col gap-6 p-6">
        <div className="flex flex-wrap gap-1.5 border-b border-border pb-4">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`rounded-[2px] px-3 py-1.5 text-xs font-medium transition-colors ${
                range === opt.value ? "bg-gold text-black" : "border border-black/10 text-muted hover:border-gold/40 hover:text-gold"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-status-declined">{error}</p>}

        <div className="flex flex-wrap border border-border">
          <StatTile icon={Percent} label="Lead win rate" value={loading ? "…" : `${winRate}%`} />
          <StatTile icon={Trophy} label="Leads won" value={loading ? "…" : summary!.leadConversion.won} />
          <StatTile icon={Clock} label="Leads pending" value={loading ? "…" : summary!.leadConversion.pending} />
          <StatTile
            icon={XCircle}
            label="Leads lost"
            value={loading ? "…" : summary!.leadConversion.lost}
            tone={summary && summary.leadConversion.lost > 0 ? "urgent" : "default"}
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
            <p className="text-sm font-semibold">Revenue trend</p>
            <div className="flex items-center gap-4 text-[11px] text-muted">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gold/70" /> Booked
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-status-approved" /> Collected
              </span>
            </div>
          </div>
          {loading && <p className="text-sm text-muted">Loading...</p>}
          {summary && summary.revenueTrend.length === 0 && <p className="text-sm text-muted">No revenue in this range yet.</p>}
          {summary && summary.revenueTrend.length > 0 && (
            <div className="flex items-end gap-2 overflow-x-auto sm:gap-3">
              {summary.revenueTrend.map((m) => (
                <div key={m.month} className="flex flex-1 min-w-[36px] flex-col items-center gap-1.5">
                  <div className="flex h-32 w-full items-end gap-0.5">
                    <div
                      className="w-1/2 bg-gold/70"
                      style={{ height: `${Math.max(2, (m.bookedCents / maxMonthCents) * 100)}%` }}
                      title={`Booked: ${money(m.bookedCents)}`}
                    />
                    <div
                      className="w-1/2 bg-status-approved"
                      style={{ height: `${Math.max(2, (m.collectedCents / maxMonthCents) * 100)}%` }}
                      title={`Collected: ${money(m.collectedCents)}`}
                    />
                  </div>
                  <span className="text-[10px] text-muted">{monthLabel(m.month)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 border-b border-border pb-2 text-sm font-semibold">Leads by source</p>
          <div className="flex flex-col divide-y divide-border">
            {loading && <p className="py-2 text-sm text-muted">Loading...</p>}
            {summary && summary.leadConversion.bySource.length === 0 && <p className="py-2 text-sm text-muted">No leads in this range yet.</p>}
            {summary?.leadConversion.bySource.map((s) => (
              <div key={s.source} className="flex items-center justify-between py-2.5 first:pt-0">
                <span className="text-sm capitalize">{s.source}</span>
                <span className="text-sm text-muted">
                  {s.total} lead{s.total === 1 ? "" : "s"} · {s.won} won · {s.pending} pending · {s.lost} lost
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <div>
            <p className="mb-2 border-b border-border pb-2 text-sm font-semibold">DJ performance</p>
            <div className="flex flex-col divide-y divide-border">
              {loading && <p className="py-2 text-sm text-muted">Loading...</p>}
              {summary && summary.djPerformance.length === 0 && <p className="py-2 text-sm text-muted">No booked events yet.</p>}
              {summary?.djPerformance.map((d) => (
                <div key={d.djId} className="flex items-center justify-between py-2.5 first:pt-0">
                  <span className="text-sm">{d.djName}</span>
                  <span className="text-sm text-muted">
                    {d.gigs} gig{d.gigs === 1 ? "" : "s"} · {money(d.revenueCents)} · avg {money(d.avgDealCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-2 border-b border-border pb-2 text-sm font-semibold">Event types</p>
            <div className="flex flex-col divide-y divide-border">
              {loading && <p className="py-2 text-sm text-muted">Loading...</p>}
              {summary && summary.eventTypes.length === 0 && <p className="py-2 text-sm text-muted">No booked events yet.</p>}
              {summary?.eventTypes.map((t) => (
                <div key={t.type} className="flex items-center justify-between py-2.5 first:pt-0">
                  <span className="text-sm capitalize">{t.type}</span>
                  <span className="flex items-center gap-1.5 text-sm text-muted">
                    <DollarSign size={12} /> {t.count} · {money(t.revenueCents)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
