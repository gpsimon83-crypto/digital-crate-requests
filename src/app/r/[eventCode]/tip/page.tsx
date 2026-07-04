import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_EVENT, TIP_PRESETS_CENTS } from "@/lib/mock-data";
import { Heart } from "lucide-react";

export default async function TipDjPage({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const { eventCode } = await params;

  return (
    <main className="flex flex-col gap-5 px-5 pt-10">
      <header className="flex flex-col items-center gap-2 text-center">
        <Heart size={32} className="text-neon-pink" />
        <h1 className="text-xl font-bold">Tip {MOCK_EVENT.dj.name}</h1>
        <p className="text-sm text-muted">100% of your tip goes straight to the DJ.</p>
      </header>

      <GlassCard className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          {TIP_PRESETS_CENTS.map((cents) => (
            <button
              key={cents}
              className="rounded-xl border border-white/10 bg-panel py-4 text-lg font-bold transition-colors hover:border-neon-pink hover:text-neon-pink min-h-[56px]"
            >
              ${(cents / 100).toFixed(0)}
            </button>
          ))}
        </div>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
            Custom amount
          </span>
          <input
            type="number"
            min={1}
            placeholder="$0.00"
            className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm placeholder:text-muted/60 focus:border-neon-pink focus:outline-none"
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
            Message (optional)
          </span>
          <input
            type="text"
            placeholder="Great set tonight!"
            className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm placeholder:text-muted/60 focus:border-neon-pink focus:outline-none"
          />
        </label>
      </GlassCard>

      <Link href={`/r/${eventCode}/review?type=tip`}>
        <NeonButton color="pink" className="w-full">Continue to Payment</NeonButton>
      </Link>
    </main>
  );
}
