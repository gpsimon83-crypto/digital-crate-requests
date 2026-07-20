"use client";

import { use, useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { DjAvatar } from "@/components/dashboard/dj-avatar";

interface EventDj {
  display_name: string;
  photo_url: string | null;
}

interface GuestRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  favoriteGenres: string[];
  marketingOptIn: boolean;
  rewardPoints: number;
  requestCount: number;
  tipTotalCents: number;
}

export default function GuestCrmPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId: eventCode } = use(params);
  const [guests, setGuests] = useState<GuestRow[]>([]);
  const [dj, setDj] = useState<EventDj | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const eventRes = await fetch(`/api/events/code/${eventCode}`);
        const eventData = await eventRes.json();
        if (!eventRes.ok) throw new Error(eventData.error || "Failed to load event");
        setDj(eventData.event.djs ?? null);

        const crmRes = await fetch(`/api/events/${eventData.event.id}/crm`);
        const crmData = await crmRes.json();
        if (!crmRes.ok) throw new Error(crmData.error || "Failed to load guests");
        setGuests(crmData.guests ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }
    load();
  }, [eventCode]);

  return (
    <>
      <PageHeader
        title="Guest CRM"
        subtitle="Everyone who has requested, tipped, or voted at your events."
        action={dj && <DjAvatar name={dj.display_name} photoUrl={dj.photo_url} size={44} />}
      />
      <div className="flex flex-col gap-3 p-6">
        {error && <p className="text-sm text-status-declined">{error}</p>}
        {!error && guests.length === 0 && <p className="text-sm text-muted">No signed-in guests yet.</p>}
        {guests.map((c) => (
          <GlassCard key={c.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{c.name}</p>
              <p className="text-xs text-muted">
                {c.email ?? "No email"} {c.phone ? `· ${c.phone}` : ""}
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {c.favoriteGenres.map((g) => (
                  <span key={g} className="rounded-full border border-black/10 px-2 py-0.5 text-[10px] text-muted">
                    {g}
                  </span>
                ))}
                {c.marketingOptIn && (
                  <span className="rounded-full border border-neon-lime/30 px-2 py-0.5 text-[10px] text-neon-lime">
                    Opted in
                  </span>
                )}
              </div>
            </div>
            <div className="flex gap-6 text-center text-xs">
              <div>
                <p className="text-lg font-bold text-neon-gold">{c.rewardPoints}</p>
                <p className="text-muted">Points</p>
              </div>
              <div>
                <p className="text-lg font-bold text-neon-cyan">{c.requestCount}</p>
                <p className="text-muted">Requests</p>
              </div>
              <div>
                <p className="text-lg font-bold text-neon-pink">${(c.tipTotalCents / 100).toFixed(0)}</p>
                <p className="text-muted">Tipped</p>
              </div>
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}
