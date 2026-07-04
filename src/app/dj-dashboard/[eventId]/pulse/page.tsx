import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_PULSE, MOCK_REQUESTS } from "@/lib/mock-data";
import { Flame } from "lucide-react";

export default function PartyPulsePage() {
  const max = Math.max(...MOCK_PULSE.history);
  const hotSongs = [...MOCK_REQUESTS].sort((a, b) => b.votes + b.boostCents - (a.votes + a.boostCents)).slice(0, 3);

  return (
    <>
      <PageHeader title="Party Pulse™" subtitle="Live event energy score, built from requests, votes, tips, and DJ actions." />
      <div className="flex flex-col gap-6 p-6">
        <GlassCard neon className="flex flex-col items-center gap-2 py-8 text-center">
          <Flame size={40} className="text-neon-orange" />
          <p className="text-5xl font-extrabold text-neon-lime">{MOCK_PULSE.crowdEnergy}%</p>
          <p className="text-sm text-muted">Crowd Energy</p>
        </GlassCard>

        <GlassCard>
          <p className="mb-3 text-sm font-semibold">Energy Trend</p>
          <div className="flex h-28 items-end gap-2">
            {MOCK_PULSE.history.map((v, i) => (
              <div
                key={i}
                className="flex-1 rounded-t-md bg-gradient-to-t from-neon-cyan to-neon-purple"
                style={{ height: `${(v / max) * 100}%` }}
              />
            ))}
          </div>
        </GlassCard>

        <div className="grid gap-6 lg:grid-cols-3">
          <GlassCard>
            <p className="mb-3 text-sm font-semibold">Top Genres</p>
            <ul className="flex flex-col gap-2">
              {MOCK_PULSE.topGenres.map((g) => (
                <li key={g.genre}>
                  <div className="mb-1 flex justify-between text-xs">
                    <span>{g.genre}</span>
                    <span className="text-muted">{g.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-white/10">
                    <div className="h-1.5 rounded-full bg-neon-purple" style={{ width: `${g.pct}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard>
            <p className="mb-3 text-sm font-semibold">Hot Songs</p>
            <ul className="flex flex-col gap-2.5 text-sm">
              {hotSongs.map((s, i) => (
                <li key={s.id} className="flex justify-between">
                  <span className="truncate">
                    <span className="text-muted mr-1">#{i + 1}</span>
                    {s.songTitle}
                  </span>
                  <span className="text-neon-orange">{s.votes}▲</span>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard>
            <p className="mb-3 text-sm font-semibold">Suggested Next</p>
            <ul className="flex flex-col gap-2.5 text-sm text-muted">
              {MOCK_PULSE.suggestedNext.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </div>
    </>
  );
}
