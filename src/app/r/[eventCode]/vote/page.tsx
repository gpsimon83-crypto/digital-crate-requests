"use client";

import { use, useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { DisclaimerBanner } from "@/components/ui/disclaimer-banner";
import { ArrowBigUp, Zap } from "lucide-react";

interface RequestRow {
  id: string;
  song_title: string;
  artist: string | null;
  status: string;
  vote_count: number;
  boost_total_cents: number;
}

export default function CrowdVotePage({ params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = use(params);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const eventRes = await fetch(`/api/events/code/${eventCode}`);
      const eventData = await eventRes.json();
      if (!eventRes.ok) throw new Error(eventData.error || "Failed to load event");

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

  async function upvote(id: string) {
    if (votedIds.includes(id)) return;
    setVotedIds((v) => [...v, id]);
    const customerId = localStorage.getItem("dcdj_guest_id") || undefined;
    try {
      await fetch(`/api/requests/${id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      await load();
    } catch {
      setVotedIds((v) => v.filter((x) => x !== id));
    }
  }

  const sorted = [...requests]
    .filter((r) => r.status !== "played" && r.status !== "declined")
    .sort((a, b) => b.vote_count - a.vote_count);

  return (
    <main className="flex flex-col gap-5 px-5 pt-10">
      <header>
        <h1 className="gold-text-gradient text-xl font-extrabold">Crowd Vote</h1>
        <p className="mt-1 text-sm text-muted">
          Upvote a song already requested instead of creating a duplicate — the DJ still has final control.
        </p>
      </header>

      {error && <p className="text-sm text-status-declined">{error}</p>}
      {!error && sorted.length === 0 && <p className="text-sm text-muted">No requests to vote on yet.</p>}

      <div className="flex flex-col gap-3">
        {sorted.map((r) => (
          <GlassCard key={r.id} className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-semibold">{r.song_title}</p>
              <p className="truncate text-xs text-muted">{r.artist}</p>
              {r.boost_total_cents > 0 && (
                <p className="mt-1 flex items-center gap-1 text-[11px] text-status-pending">
                  <Zap size={12} /> Boosted ${(r.boost_total_cents / 100).toFixed(0)}
                </p>
              )}
            </div>
            <button
              onClick={() => upvote(r.id)}
              disabled={votedIds.includes(r.id)}
              className="flex min-h-[48px] min-w-[56px] flex-col items-center gap-0.5 rounded-xl border border-gold/40 px-3 py-2 text-gold transition-colors disabled:opacity-50"
            >
              <ArrowBigUp size={20} />
              <span className="text-xs font-bold">{r.vote_count}</span>
            </button>
          </GlassCard>
        ))}
      </div>

      <DisclaimerBanner />
    </main>
  );
}
