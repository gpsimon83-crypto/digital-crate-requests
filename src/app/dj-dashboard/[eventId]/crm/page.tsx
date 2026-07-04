import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_CRM } from "@/lib/mock-data";

export default function GuestCrmPage() {
  return (
    <>
      <PageHeader title="Guest CRM" subtitle="Everyone who has requested, tipped, or voted at your events." />
      <div className="flex flex-col gap-3 p-6">
        {MOCK_CRM.map((c) => (
          <GlassCard key={c.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-muted">{c.email} &middot; {c.phone}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {c.favoriteGenres.map((g) => (
                  <span key={g} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-muted">
                    {g}
                  </span>
                ))}
                {c.marketingOptIn && (
                  <span className="rounded-full border border-neon-lime/30 px-2 py-0.5 text-[10px] text-neon-lime">
                    Opted in
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-6 text-center text-xs">
              <div>
                <p className="text-lg font-bold text-neon-gold">{c.rewardPoints}</p>
                <p className="text-muted">Points</p>
              </div>
              <div>
                <p className="text-lg font-bold text-neon-cyan">{c.requestCount}</p>
                <p className="text-muted">Requests</p>
              </div>
              <div>
                <p className="text-lg font-bold text-neon-pink">${(c.tipTotalCents / 100).toFixed(0)}</p>
                <p className="text-muted">Tipped</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}
