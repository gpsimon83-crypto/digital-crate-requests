import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_REQUESTS } from "@/lib/mock-data";
import { Check, X } from "lucide-react";

export default function CrateMatchPage() {
  return (
    <>
      <PageHeader title="Digital Crate Match" subtitle="See what's already in your crate before you approve a request." />
      <div className="flex flex-col gap-3 p-6">
        {MOCK_REQUESTS.map((r) => (
          <GlassCard key={r.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold">{r.songTitle}</p>
              <p className="text-xs text-muted">{r.artist} &middot; {r.genre} &middot; {r.bpm} BPM</p>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs sm:grid-cols-4">
              <MatchFlag label="Owned" ok={r.crate.owned} />
              <MatchFlag label="Clean version" ok={r.crate.clean} />
              <MatchFlag label="Remix available" ok={r.crate.remix} />
              <MatchFlag label="Explicit" ok={r.crate.explicit} warn />
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}

function MatchFlag({ label, ok, warn }: { label: string; ok: boolean; warn?: boolean }) {
  const activeColor = warn ? "text-neon-orange" : "text-neon-lime";
  return (
    <div className={`flex items-center gap-1.5 ${ok ? activeColor : "text-muted/50"}`}>
      {ok ? <Check size={13} /> : <X size={13} />}
      {label}
    </div>
  );
}
