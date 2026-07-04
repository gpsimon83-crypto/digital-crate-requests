import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_PRICING } from "@/lib/mock-data";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export default function PricingPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-6 py-16">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold">Pricing</h1>
          <p className="mt-2 text-muted">Every package includes Digital Crate Requests™.</p>
        </header>

        <div className="grid gap-6 lg:grid-cols-3">
          {MOCK_PRICING.map((p) => (
            <GlassCard
              key={p.id}
              neon={p.highlighted}
              className={cn("flex flex-col gap-4", !p.highlighted && "border border-white/10")}
            >
              {p.highlighted && (
                <span className="w-fit rounded-full bg-neon-purple px-3 py-1 text-[10px] font-bold text-black">
                  MOST POPULAR
                </span>
              )}
              <div>
                <p className="text-sm font-semibold">{p.name}</p>
                <p className="mt-1 text-3xl font-extrabold">{p.priceLabel}</p>
                <p className="mt-1 text-xs text-muted">{p.tagline}</p>
              </div>
              <ul className="flex flex-1 flex-col gap-2 text-sm">
                {p.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-muted">
                    <Check size={14} className="mt-0.5 shrink-0 text-neon-lime" /> {f}
                  </li>
                ))}
              </ul>
              <NeonButton color={p.highlighted ? "purple" : "cyan"} className="w-full">
                Get Started
              </NeonButton>
            </GlassCard>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
