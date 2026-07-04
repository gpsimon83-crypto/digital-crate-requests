import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { ActionTile } from "@/components/guest/action-tile";
import { DisclaimerBanner } from "@/components/ui/disclaimer-banner";
import { MOCK_EVENT, MOCK_REQUESTS } from "@/lib/mock-data";
import { Music, Flame, Music4, Heart } from "lucide-react";

export default async function EventWelcomePage({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const { eventCode } = await params;
  const topSongs = [...MOCK_REQUESTS].sort((a, b) => b.votes - a.votes).slice(0, 3);

  return (
    <main className="flex flex-col gap-6 px-5 pt-10">
      <header className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">{MOCK_EVENT.title}</h1>
        <p className="text-sm text-muted">
          {MOCK_EVENT.venue} &middot; with {MOCK_EVENT.dj.name}
        </p>
        <p className="text-[11px] font-mono text-muted/70">Event code: {eventCode}</p>
      </header>

      <GlassCard neon>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted">Party Pulse™</p>
            <p className="text-3xl font-extrabold text-status-approved">{MOCK_EVENT.crowdEnergy}%</p>
            <p className="text-xs text-muted">Crowd Energy</p>
          </div>
          <Flame className="text-status-pending" size={40} />
        </div>
      </GlassCard>

      <GlassCard>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Music size={16} className="text-gold" /> Hot Right Now
        </div>
        <ul className="flex flex-col gap-2">
          {topSongs.map((s, i) => (
            <li key={s.id} className="flex items-center justify-between text-sm">
              <span className="truncate">
                <span className="text-muted mr-2">#{i + 1}</span>
                {s.songTitle} <span className="text-muted">— {s.artist}</span>
              </span>
              <span className="text-gold font-semibold">{s.votes}▲</span>
            </li>
          ))}
        </ul>
      </GlassCard>

      <div className="flex flex-col gap-3">
        <Link href={`/r/${eventCode}/request`}>
          <ActionTile icon={Music4} title="Request a Song" subtitle="Free or paid requests" />
        </Link>
        <Link href={`/r/${eventCode}/tip`}>
          <ActionTile icon={Heart} title="Tip the DJ" subtitle="Show some love" variant="outline" />
        </Link>
        <Link href={`/r/${eventCode}/login`} className="text-center text-xs text-muted underline underline-offset-4">
          Sign in / create profile
        </Link>
      </div>

      <div className="pb-4">
        <DisclaimerBanner />
      </div>
    </main>
  );
}
