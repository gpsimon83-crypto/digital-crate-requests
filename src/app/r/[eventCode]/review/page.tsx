import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { DisclaimerBanner } from "@/components/ui/disclaimer-banner";

export default async function ReviewPayPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventCode: string }>;
  searchParams: Promise<{ type?: string }>;
}) {
  const { eventCode } = await params;
  const { type } = await searchParams;
  const isTip = type === "tip";

  return (
    <main className="flex flex-col gap-5 px-5 pt-10">
      <header>
        <h1 className="text-xl font-bold">Review &amp; Pay</h1>
        <p className="mt-1 text-sm text-muted">
          {isTip
            ? "Your tip is captured immediately and sent to the DJ."
            : "Your card will be authorized now, but only charged if the DJ plays your song."}
        </p>
      </header>

      <GlassCard className="flex flex-col gap-3 text-sm">
        <Row label={isTip ? "Tip amount" : "Request fee"} value="$10.00" />
        <Row label="Processing" value="$0.30" muted />
        <div className="h-px bg-white/10" />
        <Row label="Total" value="$10.30" bold />
      </GlassCard>

      {!isTip && (
        <GlassCard className="text-xs text-muted">
          <p className="mb-1 font-semibold text-foreground">How this charge works</p>
          <ul className="list-disc space-y-1 pl-4">
            <li>Your card is authorized now — not charged yet.</li>
            <li>If the DJ plays your song, the charge is captured.</li>
            <li>If it&apos;s declined or unplayed, the authorization is released.</li>
          </ul>
        </GlassCard>
      )}

      <DisclaimerBanner />

      <Link href={`/r/${eventCode}/confirmation`}>
        <NeonButton color={isTip ? "pink" : "cyan"} className="w-full">
          {isTip ? "Send Tip" : "Authorize & Submit"}
        </NeonButton>
      </Link>
    </main>
  );
}

function Row({
  label,
  value,
  muted,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={muted ? "text-muted" : ""}>{label}</span>
      <span className={bold ? "text-base font-bold" : muted ? "text-muted" : ""}>{value}</span>
    </div>
  );
}
