import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_EVENT, MOCK_REQUESTS, MOCK_FEED, MOCK_PULSE } from "@/lib/mock-data";

export default async function EventOverviewPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  await params;
  const pending = MOCK_REQUESTS.filter((r) => r.status === "pending").length;
  const tipsTotal = MOCK_FEED.filter((f) => f.type === "tip").length * 10;

  return (
    <>
      <PageHeader title={MOCK_EVENT.title} subtitle={`${MOCK_EVENT.venue} · Live now`} />
      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label="Crowd Energy" value={`${MOCK_PULSE.crowdEnergy}%`} />
          <StatCard label="Pending Requests" value={String(pending)} />
          <StatCard label="Tips Tonight" value={`$${tipsTotal}`} />
          <StatCard label="Active Guests" value="86" />
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <p className="mb-3 text-sm font-semibold">Requests needing action</p>
            <ul className="flex flex-col gap-2">
              {MOCK_REQUESTS.filter((r) => r.status === "pending").map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    {r.songTitle} <span className="text-muted">— {r.artist}</span>
                  </span>
                  <span className="text-gold font-semibold">{r.votes}▲</span>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard>
            <p className="mb-3 text-sm font-semibold">Live Party Feed</p>
            <ul className="flex flex-col gap-2.5 text-sm">
              {MOCK_FEED.map((f) => (
                <li key={f.id} className="flex items-start justify-between gap-3">
                  <span className="text-muted">{f.text}</span>
                  <span className="shrink-0 text-[11px] text-muted/70">{f.time}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </div>
    </>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard>
      <p className="text-xs text-muted">{label}</p>
      <p className="text-2xl font-extrabold">{value}</p>
    </GlassCard>
  );
}
