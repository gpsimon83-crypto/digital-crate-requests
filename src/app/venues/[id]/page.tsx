import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_VENUES } from "@/lib/mock-data";
import { MapPin, Music } from "lucide-react";

export default async function VenueProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const venue = MOCK_VENUES.find((v) => v.id === id);
  if (!venue) notFound();

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <header className="text-center">
          <h1 className="text-3xl font-extrabold">{venue.name}</h1>
          <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted">
            <MapPin size={14} /> {venue.location}
          </p>
        </header>

        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          <GlassCard>
            <p className="mb-2 text-sm font-semibold">DJs Who Play Here</p>
            <ul className="flex flex-col gap-1.5 text-sm text-muted">
              {venue.djs.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          </GlassCard>
          <GlassCard>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Music size={14} className="text-neon-purple" /> Top Requested Songs
            </p>
            <ul className="flex flex-col gap-1.5 text-sm text-muted">
              {venue.topRequests.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </GlassCard>
        </div>

        <GlassCard neon className="mt-6 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted">Upcoming Events</p>
            <p className="text-2xl font-extrabold text-neon-cyan">{venue.upcomingEvents}</p>
          </div>
          <NeonButton color="cyan">Book This Venue</NeonButton>
        </GlassCard>
      </main>
      <SiteFooter />
    </div>
  );
}
