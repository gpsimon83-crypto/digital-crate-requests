import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_DJS } from "@/lib/mock-data";
import { Star, Heart, Calendar } from "lucide-react";

export default async function DjProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const dj = MOCK_DJS.find((d) => d.id === id);
  if (!dj) notFound();

  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-28 w-28 items-center justify-center rounded-full neon-border text-3xl font-bold text-neon-cyan">
            {dj.name.split(" ").map((w) => w[0]).join("")}
          </div>
          <h1 className="text-2xl font-extrabold">{dj.name}</h1>
          <div className="flex items-center gap-1 text-sm text-neon-gold">
            <Star size={14} fill="currentColor" /> {dj.rating} · {dj.reviewCount} reviews
          </div>
          <p className="max-w-lg text-sm text-muted">{dj.bio}</p>
          <div className="flex gap-3 pt-2">
            <NeonButton color="cyan"><Calendar size={16} /> Book Now</NeonButton>
            <NeonButton color="pink" variant="outline"><Heart size={16} /> Tip {dj.name}</NeonButton>
          </div>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2">
          <GlassCard>
            <p className="mb-2 text-sm font-semibold">Event Types</p>
            <div className="flex flex-wrap gap-2">
              {dj.eventTypes.map((e) => (
                <span key={e} className="rounded-full border border-neon-cyan/40 px-3 py-1 text-xs text-neon-cyan">
                  {e}
                </span>
              ))}
            </div>
          </GlassCard>
          <GlassCard>
            <p className="mb-2 text-sm font-semibold">Top Genres</p>
            <div className="flex flex-wrap gap-2">
              {dj.topGenres.map((g) => (
                <span key={g} className="rounded-full border border-neon-purple/40 px-3 py-1 text-xs text-neon-purple">
                  {g}
                </span>
              ))}
            </div>
          </GlassCard>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
