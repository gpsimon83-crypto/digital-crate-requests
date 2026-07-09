"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/lib/pricing";
import { Heart } from "lucide-react";

interface EventData {
  djs: { display_name: string } | null;
}

export default function TipDjPage({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const { eventCode } = use(params);
  const router = useRouter();
  const [config, setConfig] = useState<PricingConfig>(DEFAULT_PRICING_CONFIG);
  const [event, setEvent] = useState<EventData | null>(null);
  const [selectedCents, setSelectedCents] = useState<number | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/pricing")
      .then((r) => r.json())
      .then((data) => setConfig(data.config))
      .catch(() => {});
    fetch(`/api/events/code/${eventCode}`)
      .then((r) => r.json())
      .then((data) => setEvent(data.event ?? null))
      .catch(() => {});
  }, [eventCode]);

  const customCents = customAmount ? Math.round(Number(customAmount) * 100) : 0;
  const amountCents = selectedCents ?? customCents;

  function handleContinue() {
    if (!amountCents || amountCents <= 0) {
      setError("Choose or enter a tip amount first.");
      return;
    }
    setError(null);
    router.push(
      `/r/${eventCode}/review?type=tip&amount=${amountCents}&message=${encodeURIComponent(message)}`
    );
  }

  return (
    <main className="flex flex-col gap-5 px-5 pt-10">
      <header className="hero-surface flex flex-col items-center gap-2 px-6 py-8 text-center">
        <span className="glow-ring flex h-14 w-14 items-center justify-center rounded-full bg-gold/10">
          <Heart size={26} className="text-gold" />
        </span>
        <h1 className="gold-text-gradient text-xl font-extrabold">
          Tip {event?.djs?.display_name ?? "the DJ"}
        </h1>
        <p className="text-sm text-muted">100% of your tip goes straight to the DJ.</p>
      </header>

      <GlassCard className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          {config.tipSettings.presetCents.map((cents) => (
            <button
              key={cents}
              type="button"
              onClick={() => {
                setSelectedCents(cents);
                setCustomAmount("");
              }}
              className={`rounded-xl border py-4 text-lg font-bold transition-colors min-h-[56px] ${
                selectedCents === cents
                  ? "border-gold bg-gold/10 text-gold"
                  : "border-white/10 bg-panel hover:border-gold hover:text-gold"
              }`}
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
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedCents(null);
              }}
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
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={config.tipSettings.suggestedMessages[0] ?? "Great set tonight!"}
            className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
          />
        </label>
      </GlassCard>

      {error && <p className="text-xs text-status-declined">{error}</p>}

      <NeonButton color="gold" className="w-full" onClick={handleContinue}>
        Continue to Payment
      </NeonButton>
    </main>
  );
}
