"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { Star } from "lucide-react";

const UNLOCKABLES = [
  { id: "u1", label: "Priority Request", cost: 150 },
  { id: "u2", label: "VIP Request", cost: 400 },
  { id: "u3", label: "Free Request", cost: 100 },
  { id: "u4", label: "10% Merch Discount", cost: 300 },
];

interface RequestRow {
  id: string;
  song_title: string;
  customer_id: string | null;
}

export default function RewardsPage({ params }: { params: Promise<{ eventCode: string }> }) {
  const { eventCode } = use(params);
  const [points, setPoints] = useState<number | null>(null);
  const [myRequests, setMyRequests] = useState<RequestRow[]>([]);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = localStorage.getItem("dcdj_guest_id");
    setGuestId(id);
    if (!id) return;

    async function load() {
      try {
        const guestRes = await fetch(`/api/guests?id=${id}`);
        const guestData = await guestRes.json();
        if (!guestRes.ok) throw new Error(guestData.error || "Failed to load rewards");
        setPoints(guestData.customer.reward_points ?? 0);

        const eventRes = await fetch(`/api/events/code/${eventCode}`);
        const eventData = await eventRes.json();
        if (eventRes.ok) {
          const reqRes = await fetch(`/api/events/${eventData.event.id}/requests`);
          const reqData = await reqRes.json();
          if (reqRes.ok) {
            setMyRequests((reqData.requests ?? []).filter((r: RequestRow) => r.customer_id === id));
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }
    load();
  }, [eventCode]);

  if (!guestId) {
    return (
      <main className="flex flex-col gap-5 px-5 pt-10">
        <header className="hero-surface flex flex-col items-center gap-2 px-6 py-8 text-center">
          <span className="glow-ring flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
            <Star size={26} className="text-gold" />
          </span>
          <h1 className="text-sm font-semibold uppercase tracking-[2px] text-muted">Rewards</h1>
        </header>
        <GlassCard className="flex flex-col items-center gap-2 py-8 text-center text-sm text-muted">
          <p>Create a profile to start earning points for requests, votes, and tips.</p>
          <Link href={`/r/${eventCode}/login`} className="text-gold underline underline-offset-4">
            Sign in / create profile
          </Link>
        </GlassCard>
      </main>
    );
  }

  const total = points ?? 0;

  return (
    <main className="flex flex-col gap-5 px-5 pt-10">
      <header className="hero-surface flex flex-col items-center gap-2 px-6 py-8 text-center">
        <span className="glow-ring flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
          <Star size={26} className="text-gold" />
        </span>
        <h1 className="text-sm font-semibold uppercase tracking-[2px] text-muted">Rewards</h1>
        <p className="gold-text-gradient text-4xl font-extrabold">{total} pts</p>
      </header>

      {error && <p className="text-sm text-status-declined">{error}</p>}

      <GlassCard>
        <p className="mb-2 text-sm font-semibold">Recent activity</p>
        {myRequests.length === 0 && <p className="text-sm text-muted">Nothing yet tonight.</p>}
        <ul className="flex flex-col gap-2 text-sm">
          {myRequests.map((r) => (
            <li key={r.id} className="flex justify-between text-muted">
              <span className="truncate">Requested: {r.song_title}</span>
              <span className="text-status-approved">+10</span>
            </li>
          ))}
        </ul>
      </GlassCard>

      <div>
        <p className="mb-3 text-sm font-semibold">Unlock rewards</p>
        <div className="grid grid-cols-2 gap-3">
          {UNLOCKABLES.map((u) => {
            const canAfford = total >= u.cost;
            return (
              <GlassCard key={u.id} className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm font-medium">{u.label}</p>
                <p className="text-xs text-muted">{u.cost} pts</p>
                <NeonButton
                  color="gold"
                  variant={canAfford ? "solid" : "outline"}
                  disabled={!canAfford}
                  className="w-full px-3 py-2 text-xs"
                >
                  {canAfford ? "Redeem" : "Locked"}
                </NeonButton>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </main>
  );
}
