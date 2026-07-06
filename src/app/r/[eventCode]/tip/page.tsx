"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_EVENT } from "@/lib/mock-data";
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/lib/pricing";
import { Heart } from "lucide-react";

export default function TipDjPage({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const { eventCode } = use(params);
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((data) => setConfig(data.config))
      .catch(() => {});
  }, []);

  return (
    <main className="flex flex-col gap-5 px-5 pt-10">
      <header className="hero-surface flex flex-col items-center gap-2 px-6 py-8 text-center">
        <span className="glow-ring flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
          <Heart size={26} className="text-gold" />
        </span>
        <h1 className="gold-text-gradient text-xl font-extrabold">Tip {MOCK_EVENT.dj.name}</h1>
        <p className="text-sm text-muted">100% of your tip goes straight to the DJ.</p>
      </header>

      <GlassCard className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          {config.tipSettings.presetCents.map((cents) => (
            <button
              key={cents}
              className="rounded-xl border border-white/10 bg-panel py-4 text-lg font-bold transition-colors hover:border-gold hover:text-gold min-h-[56px]"
            >
              ${(cents / 100).toFixed(0)}
            </button>
          ))}
        </div>
        {config.tipSettings.allowCustomAmount && (
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
              Custom amount
            </span>
            <input
              type="number"
              min={1}
              placeholder="$0.00"
              className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
            />
          </label>
        )}
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
            Message (optional)
          </span>
          <input
            type="text"
            placeholder={config.tipSettings.suggestedMessages[0] ?? "Great set tonight!"}
            className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
          />
        </label>
      </GlassCard>

      <Link href={`/r/${eventCode}/review?type=tip`}>
        <NeonButton color="gold" className="w-full">Continue to Payment</NeonButton>
      </Link>
    </main>
  );
}
