import Link from "next/link";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_DJS } from "@/lib/mock-data";
import { Star } from "lucide-react";

export default function MeetDjsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold">Meet Our DJs</h1>
          <p className="mt-2 text-muted">Every Digital Crate DJ brings their own style, crate, and crowd instinct.</p>
        </header>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {MOCK_DJS.map((dj) => (
            <Link key={dj.id} href={`/djs/${dj.id}`}>
              <GlassCard neon className="flex h-full flex-col gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-panel text-lg font-bold text-neon-cyan">
                  {dj.name.split(" ").map((w) => w[0]).join("")}
                </div>
                <p className="font-semibold">{dj.name}</p>
                <p className="line-clamp-2 text-xs text-muted">{dj.bio}</p>
                <div className="flex items-center gap-1 text-xs text-neon-gold">
                  <Star size={12} fill="currentColor" /> {dj.rating} ({dj.reviewCount})
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {dj.topGenres.map((g) => (
                    <span key={g} className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-muted">
                      {g}
                    </span>
                  ))}
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
