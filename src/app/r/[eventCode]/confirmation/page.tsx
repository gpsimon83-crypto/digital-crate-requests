import Link from "next/link";
import { NeonButton } from "@/components/ui/neon-button";
import { GlassCard } from "@/components/ui/glass-card";
import { ConfettiBurst } from "@/components/guest/confetti-burst";
import { PartyPopper } from "lucide-react";

export default async function ConfirmationPage({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const { eventCode } = await params;

  return (
    <main className="flex flex-col items-center gap-6 px-5 pt-16 text-center">
      <ConfettiBurst />
      <div className="hero-surface flex w-full flex-col items-center gap-3 px-6 py-10">
        <span className="glow-ring flex h-20 w-20 items-center justify-center rounded-full bg-gold/10">
          <PartyPopper size={36} className="text-gold" />
        </span>
        <div>
          <h1 className="gold-text-gradient text-2xl font-extrabold">You&apos;re In!</h1>
          <p className="mt-1 text-sm text-muted">
            Your request has been sent to the DJ. Keep an eye on the live feed.
          </p>
        </div>
      </div>

      <GlassCard className="w-full text-left text-xs text-muted">
        You earned <span className="font-semibold text-gold">+10 points</span> toward
        rewards for this action.
      </GlassCard>

      <div className="flex w-full flex-col gap-3">
        <Link href={`/r/${eventCode}/my-requests`}>
          <NeonButton color="cyan" className="w-full">View My Requests</NeonButton>
        </Link>
        <Link href={`/r/${eventCode}`} className="text-xs text-muted underline underline-offset-4">
          Back to event
        </Link>
      </div>
    </main>
  );
}
