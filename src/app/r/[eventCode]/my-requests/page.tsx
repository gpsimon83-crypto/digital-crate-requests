"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";

const STATUS_CLASS: Record<string, string> = {
  pending: "status-badge pending",
  approved: "status-badge approved",
  played: "status-badge played",
  declined: "status-badge declined",
};

interface RequestRow {
  id: string;
  song_title: string;
  artist: string | null;
  status: string;
  customer_id: string | null;
}

export default function MyRequestsPage({ params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = use(params);
  const [requests, setRequests] = useState<RequestRow[] | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("dcdj_guest_id");
    setGuestId(id);
    if (!id) {
      setRequests([]);
      return;
    }

    async function load() {
      try {
        const eventRes = await fetch(`/api/events/code/${eventCode}`);
        const eventData = await eventRes.json();
        if (!eventRes.ok) throw new Error(eventData.error || "Failed to load event");

        const reqRes = await fetch(`/api/events/${eventData.event.id}/requests`);
        const reqData = await reqRes.json();
        if (!reqRes.ok) throw new Error(reqData.error || "Failed to load requests");
        setRequests((reqData.requests ?? []).filter((r: RequestRow) => r.customer_id === id));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }
    load();
  }, [eventCode]);

  return (
    <main className="flex flex-col gap-5 px-5 pt-10">
      <header>
        <h1 className="gold-text-gradient text-xl font-extrabold">My Requests</h1>
        <p className="mt-1 text-sm text-muted">Track the status of everything you&apos;ve sent tonight.</p>
      </header>

      {error && <p className="text-sm text-status-declined">{error}</p>}

      {!guestId && requests !== null && (
        <GlassCard className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
          <p>Create a profile to track your requests across the night.</p>
          <Link href={`/r/${eventCode}/login`} className="text-gold underline underline-offset-4">
            Sign in / create profile
          </Link>
        </GlassCard>
      )}

      {guestId && requests !== null && requests.length === 0 && !error && (
        <p className="text-sm text-muted">You haven&apos;t sent any requests yet.</p>
      )}

      <div className="flex flex-col gap-3">
        {(requests ?? []).map((r) => (
          <GlassCard key={r.id} className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate font-semibold">{r.song_title}</p>
              <p className="truncate text-xs text-muted">{r.artist}</p>
            </div>
            <span className={STATUS_CLASS[r.status] ?? "status-badge pending"}>{r.status}</span>
          </GlassCard>
        ))}
      </div>
    </main>
  );
}
