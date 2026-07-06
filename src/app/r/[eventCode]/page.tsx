"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { ActionTile } from "@/components/guest/action-tile";
import { DisclaimerBanner } from "@/components/ui/disclaimer-banner";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { Music, Music4, Heart, PauseCircle } from "lucide-react";

interface EventData {
  id: string;
  title: string;
  venues: { name: string } | null;
  djs: { display_name: string; photo_url: string | null } | null;
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

  return (
    <main className="flex flex-col gap-6 px-5 pt-10">
      <header className="hero-surface flex flex-col items-center gap-3 px-6 py-8 text-center">
        {event?.djs && <DjAvatar name={event.djs.display_name} photoUrl={event.djs.photo_url} size={56} />}
        <h1 className="gold-text-gradient text-2xl font-extrabold">{event?.title ?? "Event"}</h1>
        <p className="text-sm text-muted">
          {event?.venues?.name ?? ""} {event?.djs?.display_name ? `· with ${event.djs.display_name}` : ""}
        </p>
        <p className="text-[11px] font-mono text-muted/70">Event code: {eventCode}</p>
      </header>

      {error && (
        <GlassCard className="text-center text-sm text-status-declined">
          Couldn&apos;t find this event. Double check the code with your DJ.
        </GlassCard>
      )}

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

      <div className="flex flex-col gap-3">
        {!paused ? (
          <Link href={`/r/${eventCode}/request`}>
            <ActionTile icon={Music4} title="Request a Song" subtitle="Free or paid requests" />
          </Link>
        ) : (
          <ActionTile icon={Music4} title="Requests Paused" subtitle="The DJ has paused requests" variant="outline" />
        )}
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
