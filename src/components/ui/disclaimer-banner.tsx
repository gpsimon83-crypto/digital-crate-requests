import { ShieldCheck } from "lucide-react";

export function DisclaimerBanner() {
  return (
    <div className="glass-card border border-gold/25 p-4 text-xs leading-relaxed text-muted">
      <p className="mb-1.5 flex items-center gap-1.5 font-semibold uppercase tracking-wide text-gold">
        <ShieldCheck size={13} /> Disclaimer
      </p>
      <p>
        Song requests are welcomed, but not guaranteed. All requests are subject to
        DJ approval based on event style, music selection, timing, crowd energy,
        client preferences, and appropriateness. Paid requests, votes, boosts, or
        tips do not guarantee that a song will be played.
      </p>
    </div>
  );
}
