"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { DisclaimerBanner } from "@/components/ui/disclaimer-banner";
import { EventHero } from "@/components/guest/event-hero";
import type { HeroSettings } from "@/lib/hero-settings";
import { Music, PauseCircle } from "lucide-react";

interface EventData {
  id: string;
  title: string;
  status: string;
  hero_image_url: string | null;
  venues: { name: string } | null;
  djs: { display_name: string; photo_url: string | null; hero_settings: Partial<HeroSettings> | null } | null;
  guest_request_settings?: { requestsPaused?: boolean; welcomeMessage?: string };
}

interface TopRequest {
  id: string;
  song_title: string;
  artist: string | null;
  vote_count: number;
}

export default function EventWelcomePage({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const { eventCode } = use(params);
  const [event, setEvent] = useState<EventData | null>(null);
  const [topRequests, setTopRequests] = useState<TopRequest[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/events/code/${eventCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        setEvent(data.event);
        return fetch(`/api/events/${data.event.id}/requests`);
      })
      .then((r) => r?.json())
      .then((data) => {
        if (data?.requests) {
          const top = [...data.requests]
            .filter((r: { status: string }) => r.status !== "played" && r.status !== "declined")
            .sort((a: { vote_count: number }, b: { vote_count: number }) => b.vote_count - a.vote_count)
            .slice(0, 3);
          setTopRequests(top);
        }
      })
      .catch((err) => setError(err.message));
  }, [eventCode]);

  const settings = event?.guest_request_settings ?? {};
  const paused = settings.requestsPaused;

  // Fallback chain: event's own hero photo -> DJ's hero photo (with DJ's tuning) -> luxury gradient background.
  const usingEventHero = Boolean(event?.hero_image_url);
  const heroPhoto = event?.hero_image_url ?? event?.djs?.photo_url ?? null;
  const heroSettings = usingEventHero ? undefined : event?.djs?.hero_settings;

  if (error) {
    return (
      <main className="px-5 pt-10">
        <GlassCard className="text-center text-sm text-status-declined">
          Couldn&apos;t find this event. Double check the code with your DJ.
        </GlassCard>
      </main>
    );
  }

  if (!event) {
    return (
      <div className="h-[420px] w-full animate-pulse bg-gradient-to-br from-panel via-dark3 to-panel sm:h-[500px]" />
    );
  }

  return (
    <main className="flex flex-col">
      <EventHero
        eventCode={eventCode}
        title={event.title}
        venueName={event.venues?.name}
        djName={event.djs?.display_name}
        djPhoto={heroPhoto}
        heroSettings={heroSettings}
        status={event.status}
        paused={paused}
      />

      <div className="relative z-10 -mt-4 flex flex-col gap-4 px-5">
        {settings.welcomeMessage && (
          <GlassCard neon className="text-center text-sm">
            {settings.welcomeMessage}
          </GlassCard>
        )}

        {paused && (
          <GlassCard className="flex items-center justify-center gap-2 text-sm text-status-pending">
            <PauseCircle size={16} /> Requests are paused right now — check back soon.
          </GlassCard>
        )}

        {topRequests.length > 0 && (
          <GlassCard>
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Music size={16} className="text-gold" /> Hot Right Now
            </div>
            <ul className="flex flex-col gap-2">
              {topRequests.map((s, i) => (
                <li key={s.id} className="flex items-center justify-between text-sm">
                  <span className="truncate">
                    <span className="text-muted mr-2">#{i + 1}</span>
                    {s.song_title} <span className="text-muted">— {s.artist}</span>
                  </span>
                  <span className="text-gold font-semibold">{s.vote_count}▲</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        )}

        <Link href={`/r/${eventCode}/login`} className="text-center text-xs text-muted underline underline-offset-4">
          Sign in / create profile
        </Link>

        <div className="pb-4">
          <DisclaimerBanner />
        </div>
      </div>
    </main>
  );
}
