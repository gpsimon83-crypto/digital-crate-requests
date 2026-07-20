"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Gauge } from "lucide-react";
import type { ResolvedTrack } from "@/lib/crate-track-resolver";
import type { GuidedSetup } from "@/components/dashboard/guided-crate-setup";
import { computeCrateScore } from "@/lib/crate-score";
import { NewBadge } from "@/components/dashboard/new-badge";
import { ScoreMeter } from "@/components/dashboard/score-meter";

// Same three status bands used by the meter — a state-of-health job, not a
// ranked-magnitude one, so status color (not a sequential hue) is correct.
function scoreColor(score: number): string {
  if (score >= 80) return "text-status-approved";
  if (score >= 55) return "text-gold";
  return "text-status-declined";
}
function scoreBarColor(score: number): string {
  if (score >= 80) return "bg-status-approved";
  if (score >= 55) return "bg-gold";
  return "bg-status-declined";
}

/** Crate Score — 0-100 guidance, never blocks saving or exporting. Click a
 * category to see plain-language recommendations. */
export function CrateScorePanel({ tracks, guidedSetup }: { tracks: ResolvedTrack[] | null; guidedSetup: GuidedSetup | null }) {
  const [expanded, setExpanded] = useState(true);
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  const result = tracks ? computeCrateScore(tracks, guidedSetup) : null;

  return (
    <div className="rounded-xl border border-white/8 bg-panel/40">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <Gauge size={13} /> Crate Score
          <NewBadge />
        </span>
        {expanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
      </button>

      {expanded && (
        <div className="border-t border-white/8 p-3">
          {!result ? (
            <p className="text-xs text-muted">Analyzing…</p>
          ) : result.categories.length === 0 ? (
            <p className="text-xs text-muted">Add songs to this crate to see a score.</p>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <ScoreMeter value={result.overall} size={64} />
                <div>
                  <p className="text-sm font-semibold">Overall Score</p>
                  <p className="text-xs text-muted">Guidance only — never blocks saving or exporting.</p>
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-xs">
                {result.categories.map((c) => (
                  <div key={c.label} className="rounded-lg border border-white/8">
                    <button
                      onClick={() => setOpenCategory((cur) => (cur === c.label ? null : c.label))}
                      className="flex w-full flex-col gap-1.5 px-2.5 py-2 text-left"
                      disabled={c.recommendations.length === 0}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span>{c.label}</span>
                        <span className={`font-bold ${scoreColor(c.score)}`}>{c.score}</span>
                      </span>
                      {/* Bar mark: rounded data-end, square at the baseline, capped thickness. */}
                      <span className="h-2 w-full overflow-hidden rounded-r-full bg-white/8">
                        <span
                          className={`block h-full rounded-r-full ${scoreBarColor(c.score)}`}
                          style={{ width: `${c.score}%` }}
                        />
                      </span>
                    </button>
                    {openCategory === c.label && c.recommendations.length > 0 && (
                      <div className="border-t border-white/8 px-2.5 py-2 text-[11px] text-muted">
                        {c.recommendations.map((r, i) => <p key={i}>{r}</p>)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
