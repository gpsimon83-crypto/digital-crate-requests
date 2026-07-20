"use client";

import { use, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { Flame, Music2, Sparkles, Star } from "lucide-react";

interface EventDj {
  display_name: string;
  photo_url: string | null;
}

interface PulseData {
  crowdEnergy: number;
  history: number[];
  topGenres: { genre: string; pct: number }[];
  hotSongs: { songTitle: string; artist: string | null; votes: number }[];
  suggestedNext: string[];
}

function energyLabel(energy: number) {
  if (energy >= 70) return "High energy! Keep it up, the crowd is loving it.";
  if (energy >= 40) return "Building steadily — a couple of crowd favorites will spike it.";
  return "Still warming up — try a well-known opener to get the floor moving.";
}

function EnergyGauge({ value }: { value: number }) {
  const size = 200;
  const stroke = 12;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  return (
    <div className="relative flex h-[200px] w-[200px] shrink-0 items-center justify-center">
      <svg width={size} height={size} className="glow-ring -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(33,31,26,0.1)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="url(#gaugeGradient)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
        <defs>
          <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--gold-light)" />
            <stop offset="100%" stopColor="var(--gold)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute flex flex-col items-center">
        <Flame size={26} className="mb-1 text-gold" />
        <p className="gold-text-gradient text-4xl font-extrabold leading-none">{value}%</p>
        <p className="mt-1.5 text-[11px] uppercase tracking-[2px] text-muted">Crowd Energy</p>
      </div>
    </div>
  );
}

function EnergyTrendChart({ history }: { history: number[] }) {
  const width = 640;
  const height = 140;
  const max = Math.max(1, ...history);
  const stepX = width / Math.max(1, history.length - 1);

  const points = history.map((v, i) => {
    const x = i * stepX;
    const y = height - (v / max) * (height - 20) - 8;
    return [x, y] as const;
  });

  const linePath = points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x},${y}`).join(" ");
  const areaPath = `${linePath} L${width},${height} L0,${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-32 w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="areaGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="var(--gold)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--gold)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill="url(#areaGradient)" />
      <path d={linePath} fill="none" stroke="var(--gold)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3.5} fill="var(--gold-light)" stroke="#0A0A0A" strokeWidth={1.5} />
      ))}
    </svg>
  );
}

export default function PartyPulsePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: eventCode } = use(params);
  const [pulse, setPulse] = useState<PulseData | null>(null);
  const [dj, setDj] = useState<EventDj | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const eventRes = await fetch(`/api/events/code/${eventCode}`);
        const eventData = await eventRes.json();
        if (!eventRes.ok) throw new Error(eventData.error || "Failed to load event");
        setDj(eventData.event.djs ?? null);

        const pulseRes = await fetch(`/api/events/${eventData.event.id}/pulse`);
        const pulseData = await pulseRes.json();
        if (!pulseRes.ok) throw new Error(pulseData.error || "Failed to load pulse");
        setPulse(pulseData.pulse);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }
    load();
    const interval = setInterval(load, 15000);
    return () => clearInterval(interval);
  }, [eventCode]);

  if (error) {
    return (
      <>
        <PageHeader title="Party Pulse™" subtitle="" />
        <p className="p-6 text-sm text-status-declined">{error}</p>
      </>
    );
  }

  if (!pulse) {
    return (
      <>
        <PageHeader title="Party Pulse™" subtitle="" />
        <p className="p-6 text-sm text-muted">Loading...</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Party Pulse™"
        subtitle="Live event energy score, built from requests, votes, tips, and DJ actions."
        action={dj && <DjAvatar name={dj.display_name} photoUrl={dj.photo_url} size={44} />}
      />
      <div className="flex flex-col gap-6 p-6 sm:p-8">
        <div className="hero-surface flex flex-col items-center gap-6 px-6 py-10 sm:flex-row sm:justify-between sm:px-10">
          <div className="max-w-sm text-center sm:text-left">
            <p className="gold-text-gradient text-lg font-bold">
              {pulse.crowdEnergy >= 70 ? "High energy!" : pulse.crowdEnergy >= 40 ? "Building momentum" : "Warming up"}
            </p>
            <p className="mt-2 text-sm text-muted">{energyLabel(pulse.crowdEnergy)}</p>
          </div>
          <EnergyGauge value={pulse.crowdEnergy} />
        </div>

        <GlassCard className="!p-5 sm:!p-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-wide text-muted">Energy Trend</p>
            <Sparkles size={16} className="text-gold" />
          </div>
          <EnergyTrendChart history={pulse.history} />
        </GlassCard>

        <div className="grid gap-6 lg:grid-cols-3">
          <GlassCard className="!p-5 sm:!p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 text-gold">
                <Music2 size={14} />
              </span>
              <p className="text-sm font-semibold">Top Genres</p>
            </div>
            {pulse.topGenres.length === 0 && <p className="text-xs text-muted">No requests yet.</p>}
            <ul className="flex flex-col gap-3">
              {pulse.topGenres.map((g) => (
                <li key={g.genre}>
                  <div className="mb-1.5 flex justify-between text-xs">
                    <span className="font-medium">{g.genre}</span>
                    <span className="text-muted">{g.pct}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-black/8">
                    <div
                      className="h-1.5 rounded-full bg-gradient-to-r from-[var(--gold-dim)] to-[var(--gold)]"
                      style={{ width: `${g.pct}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard className="!p-5 sm:!p-6">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Flame size={14} />
                </span>
                <p className="text-sm font-semibold">Hot Songs</p>
              </div>
              <button className="rounded-full border border-gold/30 px-3 py-1 text-[11px] font-semibold text-gold transition-colors hover:bg-gold/10">
                View All
              </button>
            </div>
            {pulse.hotSongs.length === 0 && <p className="text-xs text-muted">No requests yet.</p>}
            <ul className="flex flex-col gap-3 text-sm">
              {pulse.hotSongs.map((s, i) => (
                <li key={`${s.songTitle}-${i}`} className="flex items-center justify-between">
                  <span className="truncate">
                    <span className="mr-2 text-muted">#{i + 1}</span>
                    {s.songTitle}
                    {s.artist && <span className="ml-1 text-muted">— {s.artist}</span>}
                  </span>
                  <span className="shrink-0 font-semibold text-gold">{s.votes}▲</span>
                </li>
              ))}
            </ul>
            <button className="mt-5 w-full rounded-full border border-gold/30 py-2.5 text-xs font-semibold text-gold transition-colors hover:bg-gold/10">
              View Full Playlist
            </button>
          </GlassCard>

          <GlassCard className="!p-5 sm:!p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 text-gold">
                <Star size={14} />
              </span>
              <p className="text-sm font-semibold">Suggested Next</p>
            </div>
            {pulse.suggestedNext.length === 0 && <p className="text-xs text-muted">Nothing queued.</p>}
            <ul className="flex flex-col gap-3 text-sm text-muted">
              {pulse.suggestedNext.map((s) => (
                <li key={s} className="truncate">{s}</li>
              ))}
            </ul>
            <button className="mt-5 w-full rounded-full bg-gradient-to-r from-[var(--gold-light)] to-[var(--gold)] py-2.5 text-xs font-bold text-black btn-gold-solid transition-transform hover:scale-[1.01]">
              Add to Queue
            </button>
          </GlassCard>
        </div>
      </div>
    </>
  );
}
