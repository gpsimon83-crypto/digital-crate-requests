import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_ANALYTICS } from "@/lib/mock-data";

const COLOR_VAR: Record<string, string> = {
  pink: "var(--neon-pink)",
  cyan: "var(--neon-cyan)",
  orange: "var(--neon-orange)",
};

export default function AnalyticsPage() {
  const maxWeekly = Math.max(...MOCK_ANALYTICS.weeklyRequests);
  const totalRevenue = MOCK_ANALYTICS.revenueByType.reduce((s, r) => s + r.amountCents, 0);

  return (
    <>
      <PageHeader title="Analytics" subtitle="Performance across all your Digital Crate DJs events." />
      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Stat label="Total Events" value={String(MOCK_ANALYTICS.totalEvents)} />
          <Stat label="Total Requests" value={MOCK_ANALYTICS.totalRequests.toLocaleString()} />
          <Stat label="Total Tips" value={`$${(MOCK_ANALYTICS.totalTipsCents / 100).toLocaleString()}`} />
          <Stat label="Avg Crowd Energy" value={`${MOCK_ANALYTICS.avgCrowdEnergy}%`} />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <p className="mb-3 text-sm font-semibold">Requests This Week</p>
            <div className="flex h-32 items-end gap-2">
              {MOCK_ANALYTICS.weeklyRequests.map((v, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t-md bg-gradient-to-t from-neon-purple to-neon-cyan"
                  style={{ height: `${(v / maxWeekly) * 100}%` }}
                />
              ))}
            </div>
          </GlassCard>

          <GlassCard>
            <p className="mb-3 text-sm font-semibold">Revenue by Type</p>
            <ul className="flex flex-col gap-3">
              {MOCK_ANALYTICS.revenueByType.map((r) => {
                const pct = Math.round((r.amountCents / totalRevenue) * 100);
                return (
                  <li key={r.label}>
                    <div className="mb-1 flex justify-between text-xs">
                      <span>{r.label}</span>
                      <span className="text-muted">${(r.amountCents / 100).toLocaleString()}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/10">
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${pct}%`, background: COLOR_VAR[r.color] }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </GlassCard>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard neon>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-extrabold text-neon-cyan">{value}</p>
    </GlassCard>
  );
}
