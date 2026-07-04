import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_EVENT_SETTINGS } from "@/lib/mock-data";

export default function SongListsPage() {
  return (
    <>
      <PageHeader title="Song Lists" subtitle="Tell your DJ exactly what to play — and what to skip." />
      <div className="flex flex-col gap-6 p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-neon-lime">Must-Play List</p>
            <ul className="flex flex-col gap-2 text-sm text-muted">
              {MOCK_EVENT_SETTINGS.mustPlay.map((s) => (
                <li key={s} className="rounded-lg border border-white/10 bg-panel px-3 py-2">{s}</li>
              ))}
            </ul>
            <input
              placeholder="Add a song..."
              className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm placeholder:text-muted/60 focus:border-neon-lime focus:outline-none"
            />
          </GlassCard>

          <GlassCard className="flex flex-col gap-3">
            <p className="text-sm font-semibold text-neon-pink">Do-Not-Play List</p>
            <ul className="flex flex-col gap-2 text-sm text-muted">
              {MOCK_EVENT_SETTINGS.doNotPlay.map((s) => (
                <li key={s} className="rounded-lg border border-white/10 bg-panel px-3 py-2">{s}</li>
              ))}
            </ul>
            <input
              placeholder="Add a song or artist..."
              className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm placeholder:text-muted/60 focus:border-neon-pink focus:outline-none"
            />
          </GlassCard>
        </div>
        <NeonButton color="cyan" className="w-full sm:w-fit">Save Lists</NeonButton>
      </div>
    </>
  );
}
