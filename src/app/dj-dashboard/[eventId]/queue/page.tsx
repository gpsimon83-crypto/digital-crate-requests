"use client";

import { use, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { Check, X, PlayCircle, Zap, AlertTriangle } from "lucide-react";

interface EventDj {
  display_name: string;
  photo_url: string | null;
}

interface RequestRow {
  id: string;
  song_title: string;
  artist: string | null;
  status: string;
  genre: string | null;
  bpm: number | null;
  vote_count: number;
  boost_total_cents: number;
  explicit: boolean;
  crate_match: { owned_by_dj?: boolean } | null;
}

export default function LiveQueuePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: eventCode } = use(params);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [dj, setDj] = useState<EventDj | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  async function load() {
    try {
      const eventRes = await fetch(`/api/events/code/${eventCode}`);
      const eventData = await eventRes.json();
      if (!eventRes.ok) throw new Error(eventData.error || "Failed to load event");
      setDj(eventData.event.djs ?? null);

      const reqRes = await fetch(`/api/events/${eventData.event.id}/requests`);
      const reqData = await reqRes.json();
      if (!reqRes.ok) throw new Error(reqData.error || "Failed to load requests");
      setRequests(reqData.requests ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    load();
  }, [eventCode]);

  async function act(id: string, action: "approve" | "decline" | "mark-played") {
    setActingId(id);
    try {
      await fetch(`/api/requests/${id}/${action}`, { method: "POST" });
      await load();
    } finally {
      setActingId(null);
    }
  }

  const visible = requests.filter((r) => r.status !== "declined");

  return (
    <>
      <PageHeader
        title="Live Request Queue"
        subtitle="Approve, decline, or mark songs as played in real time."
        action={dj && <DjAvatar name={dj.display_name} photoUrl={dj.photo_url} size={44} />}
      />
      <div className="flex flex-col gap-3 p-6">
        {error && <p className="text-sm text-status-declined">{error}</p>}
        {!error && visible.length === 0 && <p className="text-sm text-muted">No requests yet.</p>}
        {visible.map((r) => (
          <GlassCard key={r.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{r.song_title}</p>
                <span className="text-xs text-muted">{r.artist}</span>
                {r.explicit && (
                  <span className="status-badge pending !px-2 !py-0.5 !text-[10px]">
                    <AlertTriangle size={10} /> Explicit
                  </span>
                )}
                {r.crate_match && r.crate_match.owned_by_dj === false && (
                  <span className="status-badge declined !px-2 !py-0.5 !text-[10px]">
                    Missing from crate
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                {r.genre && <span>{r.genre}</span>}
                {r.bpm && <span>{r.bpm} BPM</span>}
                <span className="text-gold">{r.vote_count} votes</span>
                {r.boost_total_cents > 0 && (
                  <span className="flex items-center gap-1 text-status-pending">
                    <Zap size={11} /> ${(r.boost_total_cents / 100).toFixed(0)} boost
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {r.status === "pending" && (
                <>
                  <button
                    disabled={actingId === r.id}
                    onClick={() => act(r.id, "approve")}
                    className="flex items-center gap-1 rounded-full bg-status-approved px-4 py-2 text-xs font-bold text-black disabled:opacity-50"
                  >
                    <Check size={14} /> Approve
                  </button>
                  <button
                    disabled={actingId === r.id}
                    onClick={() => act(r.id, "decline")}
                    className="flex items-center gap-1 rounded-full bg-status-declined px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                  >
                    <X size={14} /> Decline
                  </button>
                </>
              )}
              {r.status === "approved" && (
                <button
                  disabled={actingId === r.id}
                  onClick={() => act(r.id, "mark-played")}
                  className="flex items-center gap-1 rounded-full bg-status-played px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
                >
                  <PlayCircle size={14} /> Mark Played
                </button>
              )}
              {r.status === "played" && <span className="status-badge played">Played</span>}
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}
