import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_VENUES } from "@/lib/mock-data";
import { MapPin } from "lucide-react";

export default function VenuesPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold">Our Venues</h1>
          <p className="mt-2 text-muted">Where Digital Crate DJs plays every week.</p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_VENUES.map((v) => (
            <Link key={v.id} href={`/venues/${v.id}`}>
              <GlassCard neon className="flex h-full flex-col gap-2">
                <p className="font-semibold">{v.name}</p>
                <p className="flex items-center gap-1 text-xs text-muted">
                  <MapPin size={12} /> {v.location}
                </p>
                <p className="text-xs text-neon-cyan">{v.upcomingEvents} upcoming events</p>
              </GlassCard>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
