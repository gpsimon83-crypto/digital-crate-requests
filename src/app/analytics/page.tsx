"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Logo } from "@/components/site/logo";
import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface Totals {
  totalTipsCents: number;
  totalBoostsCents: number;
  totalPaidRequestsCents: number;
  totalRequests: number;
  totalEvents: number;
  totalDjs: number;
  totalVenues: number;
}

interface RankedEntry {
  name: string;
  count: number;
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [totals, setTotals] = useState<Totals | null>(null);
  const [topDjs, setTopDjs] = useState<RankedEntry[]>([]);
  const [topVenues, setTopVenues] = useState<RankedEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/analytics");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load analytics");
        setTotals(data.totals);
        setTopDjs(data.topDjs ?? []);
        setTopVenues(data.topVenues ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }
    load();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/dj-dashboard/login");
    router.refresh();
  }

  const revenue = totals ? totals.totalTipsCents + totals.totalBoostsCents + totals.totalPaidRequestsCents : 0;

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-4">
        <div className="flex items-center gap-2">
          <Logo variant="icon" color="white" size={26} />
          <div>
            <p className="text-[10px] uppercase tracking-[2px] text-muted">Digital Crate DJs</p>
            <p className="text-sm font-semibold">Analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/admin" className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-muted hover:text-foreground">
            Admin Panel
          </Link>
          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-xs text-muted hover:text-foreground"
          >
            <LogOut size={13} /> Sign Out
          </button>
        </div>
      </header>

      <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
        {error && <p className="text-sm text-status-declined">{error}</p>}
        {!totals && !error && <p className="text-sm text-muted">Loading...</p>}

        {totals && (
          <>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              <GlassCard neon>
                <p className="text-xs text-muted">Total Revenue</p>
                <p className="text-2xl font-extrabold text-gold">${(revenue / 100).toFixed(2)}</p>
              </GlassCard>
              <GlassCard>
                <p className="text-xs text-muted">Total Events</p>
                <p className="text-2xl font-extrabold">{totals.totalEvents}</p>
              </GlassCard>
              <GlassCard>
                <p className="text-xs text-muted">Total Requests</p>
                <p className="text-2xl font-extrabold">{totals.totalRequests}</p>
              </GlassCard>
              <GlassCard>
                <p className="text-xs text-muted">DJs / Venues</p>
                <p className="text-2xl font-extrabold">
                  {totals.totalDjs} / {totals.totalVenues}
                </p>
              </GlassCard>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <GlassCard>
                <p className="text-xs text-muted">Tips</p>
                <p className="text-xl font-bold text-status-approved">${(totals.totalTipsCents / 100).toFixed(2)}</p>
              </GlassCard>
              <GlassCard>
                <p className="text-xs text-muted">Boosts</p>
                <p className="text-xl font-bold text-status-pending">${(totals.totalBoostsCents / 100).toFixed(2)}</p>
              </GlassCard>
              <GlassCard>
                <p className="text-xs text-muted">Paid Requests Captured</p>
                <p className="text-xl font-bold text-status-played">${(totals.totalPaidRequestsCents / 100).toFixed(2)}</p>
              </GlassCard>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <GlassCard>
                <p className="mb-3 text-sm font-semibold">Top DJs (by events)</p>
                {topDjs.length === 0 && <p className="text-xs text-muted">No data yet.</p>}
                <ul className="flex flex-col gap-2 text-sm">
                  {topDjs.map((d) => (
                    <li key={d.name} className="flex justify-between">
                      <span>{d.name}</span>
                      <span className="text-muted">{d.count} events</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
              <GlassCard>
                <p className="mb-3 text-sm font-semibold">Top Venues (by events)</p>
                {topVenues.length === 0 && <p className="text-xs text-muted">No data yet.</p>}
                <ul className="flex flex-col gap-2 text-sm">
                  {topVenues.map((v) => (
                    <li key={v.name} className="flex justify-between">
                      <span>{v.name}</span>
                      <span className="text-muted">{v.count} events</span>
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
