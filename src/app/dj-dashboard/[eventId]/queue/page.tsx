import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_REQUESTS } from "@/lib/mock-data";
import { Check, X, PlayCircle, Zap, AlertTriangle } from "lucide-react";

export default function LiveQueuePage() {
  return (
    <>
      <PageHeader title="Live Request Queue" subtitle="Approve, decline, or mark songs as played in real time." />
      <div className="flex flex-col gap-3 p-6">
        {MOCK_REQUESTS.map((r) => (
          <GlassCard key={r.id} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{r.songTitle}</p>
                <span className="text-xs text-muted">{r.artist}</span>
                {r.crate.explicit && (
                  <span className="status-badge pending !px-2 !py-0.5 !text-[10px]">
                    <AlertTriangle size={10} /> Explicit
                  </span>
                )}
                {!r.crate.owned && (
                  <span className="status-badge declined !px-2 !py-0.5 !text-[10px]">
                    Missing from crate
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-muted">
                <span>{r.genre}</span>
                <span>{r.bpm} BPM</span>
                <span className="text-gold">{r.votes} votes</span>
                {r.boostCents > 0 && (
                  <span className="flex items-center gap-1 text-status-pending">
                    <Zap size={11} /> ${(r.boostCents / 100).toFixed(0)} boost
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {r.status === "pending" && (
                <>
                  <button className="flex items-center gap-1 rounded-full bg-status-approved px-4 py-2 text-xs font-bold text-black">
                    <Check size={14} /> Approve
                  </button>
                  <button className="flex items-center gap-1 rounded-full bg-status-declined px-4 py-2 text-xs font-bold text-white">
                    <X size={14} /> Decline
                  </button>
                </>
              )}
              {r.status === "approved" && (
                <button className="flex items-center gap-1 rounded-full bg-status-played px-4 py-2 text-xs font-bold text-white">
                  <PlayCircle size={14} /> Mark Played
                </button>
              )}
              {r.status === "played" && <span className="status-badge played">Played</span>}
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}
