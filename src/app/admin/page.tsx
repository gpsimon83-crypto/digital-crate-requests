import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_ADMIN_STATS, MOCK_DJS, MOCK_VENUES } from "@/lib/mock-data";

export default function AdminOverviewPage() {
  return (
    <>
      <PageHeader title="Admin Overview" subtitle="Platform-wide stats and management." />
      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <GlassCard>
            <p className="text-xs text-muted">DJs</p>
            <p className="text-2xl font-extrabold">{MOCK_ADMIN_STATS.totalDjs}</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs text-muted">Venues</p>
            <p className="text-2xl font-extrabold">{MOCK_ADMIN_STATS.totalVenues}</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs text-muted">Total Events</p>
            <p className="text-2xl font-extrabold">{MOCK_ADMIN_STATS.totalEvents}</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs text-muted">Active Invite Codes</p>
            <p className="text-2xl font-extrabold">{MOCK_ADMIN_STATS.activeInviteCodes}</p>
          </GlassCard>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <p className="mb-3 text-sm font-semibold">DJ Roster</p>
            <ul className="flex flex-col gap-2 text-sm">
              {MOCK_DJS.map((d) => (
                <li key={d.id} className="flex justify-between">
                  <span>{d.name}</span>
                  <span className="text-muted">{d.reviewCount} reviews</span>
                </li>
              ))}
            </ul>
          </GlassCard>
          <GlassCard>
            <p className="mb-3 text-sm font-semibold">Venues</p>
            <ul className="flex flex-col gap-2 text-sm">
              {MOCK_VENUES.map((v) => (
                <li key={v.id} className="flex justify-between">
                  <span>{v.name}</span>
                  <span className="text-muted">{v.upcomingEvents} upcoming</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </div>
    </>
  );
}
