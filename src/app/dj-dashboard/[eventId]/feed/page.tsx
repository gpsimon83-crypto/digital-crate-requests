"use client";

import { use, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { Music4, Heart, Zap, PlayCircle, Megaphone, Flame } from "lucide-react";

interface EventDj {
  display_name: string;
  photo_url: string | null;
}

const TYPE_META: Record<string, { icon: typeof Music4; color: string }> = {
  request: { icon: Music4, color: "text-gold" },
  tip: { icon: Heart, color: "text-status-declined" },
  boost: { icon: Zap, color: "text-status-pending" },
  played: { icon: PlayCircle, color: "text-status-approved" },
  announcement: { icon: Megaphone, color: "text-status-played" },
  crowd_favorite: { icon: Flame, color: "text-gold" },
};

interface FeedRow {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

function describeFeedEvent(f: FeedRow): string {
  const payload = f.payload ?? {};
  switch (f.type) {
    case "request":
      return `Requested: ${payload.songTitle ?? "a song"}${payload.artist ? ` — ${payload.artist}` : ""}`;
    case "tip":
      return `Tip received: $${((payload.amountCents as number) / 100).toFixed(2)}`;
    case "boost":
      return `Boosted: ${payload.songTitle ?? "a song"} +$${((payload.amountCents as number) / 100).toFixed(0)}`;
    case "played":
      return `Played: ${payload.songTitle ?? "a song"}`;
    default:
      return f.type;
  }
}

export default function LivePartyFeedPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: eventCode } = use(params);
  const [feed, setFeed] = useState<FeedRow[]>([]);
  const [dj, setDj] = useState<EventDj | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const eventRes = await fetch(`/api/events/code/${eventCode}`);
        const eventData = await eventRes.json();
        if (!eventRes.ok) throw new Error(eventData.error || "Failed to load event");
        setDj(eventData.event.djs ?? null);

        const feedRes = await fetch(`/api/events/${eventData.event.id}/feed`);
        const feedData = await feedRes.json();
        if (!feedRes.ok) throw new Error(feedData.error || "Failed to load feed");
        setFeed(feedData.feed ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }
    load();
    const interval = setInterval(load, 8000);
    return () => clearInterval(interval);
  }, [eventCode]);

  return (
    <>
      <PageHeader
        title="Live Party Feed"
        subtitle="Everything happening at your event, in real time."
        action={dj && <DjAvatar name={dj.display_name} photoUrl={dj.photo_url} size={44} />}
      />
      <div className="flex flex-col gap-3 p-6">
        {error && <p className="text-sm text-status-declined">{error}</p>}
        {!error && feed.length === 0 && <p className="text-sm text-muted">No activity yet.</p>}
        {feed.map((f) => {
          const meta = TYPE_META[f.type] ?? TYPE_META.request;
          const Icon = meta.icon;
          return (
            <GlassCard key={f.id} className="flex items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 ${meta.color}`}>
                <Icon size={16} />
              </span>
              <p className="flex-1 text-sm text-muted">{describeFeedEvent(f)}</p>
              <span className="shrink-0 text-[11px] text-muted/70">
                {new Date(f.created_at).toLocaleTimeString()}
              </span>
            </GlassCard>
          );
        })}
      </div>
    </>
  );
}
