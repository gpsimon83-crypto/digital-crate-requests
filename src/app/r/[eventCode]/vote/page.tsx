import { GlassCard } from "@/components/ui/glass-card";
import { DisclaimerBanner } from "@/components/ui/disclaimer-banner";
import { MOCK_REQUESTS, BOOST_PRESETS_CENTS } from "@/lib/mock-data";
import { ArrowBigUp, Zap } from "lucide-react";

export default function CrowdVotePage() {
  const sorted = [...MOCK_REQUESTS]
    .filter((r) => r.status !== "played")
    .sort((a, b) => b.votes - a.votes);

  return (
    <main className="flex flex-col gap-5 px-5 pt-10">
      <header>
        <h1 className="text-xl font-bold">Crowd Vote</h1>
        <p className="mt-1 text-sm text-muted">
          Upvote a song already requested instead of creating a duplicate. Boost it to
          increase visibility — the DJ still has final control.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {sorted.map((r) => (
          <GlassCard key={r.id} className="flex flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">{r.songTitle}</p>
                <p className="truncate text-xs text-muted">{r.artist}</p>
              </div>
              <button className="flex flex-col items-center gap-0.5 rounded-xl border border-neon-cyan/40 px-3 py-2 text-neon-cyan min-h-[48px] min-w-[56px]">
                <ArrowBigUp size={20} />
                <span className="text-xs font-bold">{r.votes}</span>
              </button>
            </div>

            {r.boostCents > 0 && (
              <p className="flex items-center gap-1 text-[11px] text-neon-orange">
                <Zap size={12} /> Boosted ${(r.boostCents / 100).toFixed(0)}
              </p>
            )}

            <div className="flex gap-2">
              {BOOST_PRESETS_CENTS.map((cents) => (
                <button
                  key={cents}
                  className="flex-1 rounded-lg border border-white/10 bg-panel py-2 text-xs font-medium text-muted transition-colors hover:border-neon-pink hover:text-neon-pink min-h-[40px]"
                >
                  Boost ${(cents / 100).toFixed(0)}
                </button>
              ))}
              <button className="flex-1 rounded-lg border border-white/10 bg-panel py-2 text-xs font-medium text-muted min-h-[40px]">
                Custom
              </button>
            </div>
          </GlassCard>
        ))}
      </div>

      <DisclaimerBanner />
    </main>
  );
}
