"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, BarChart3 } from "lucide-react";
import type { CrateRow } from "@/lib/browser-serato";
import { getFileHandleForPath } from "@/lib/crate-art";
import { energyScoreToLevel } from "@/lib/crate-taxonomy";
import { NewBadge } from "@/components/dashboard/new-badge";
import type { ResolvedTrack } from "@/lib/crate-track-resolver";
import { StackedBarChart } from "@/components/dashboard/stacked-bar-chart";

const DURATION_CONCURRENCY = 4;

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/** Collapsible balance panel for the currently-open crate — distribution
 * of genre/era/energy/BPM, clean vs. explicit, Elite/proven/new counts,
 * and total playtime (loaded lazily, only for this one crate — never the
 * whole library). Tracks are resolved once by the parent (CrateDetailView)
 * via lib/crate-track-resolver.ts and passed in, so multiple panels never
 * re-read the same crate from disk. */
export function CrateBalanceOverview({
  crate,
  rootHandle,
  tracks,
}: {
  crate: CrateRow;
  rootHandle: FileSystemDirectoryHandle;
  tracks: ResolvedTrack[] | null;
}) {
  const [expanded, setExpanded] = useState(true);
  const [durationSeconds, setDurationSeconds] = useState<number | null>(null);
  const [durationLoading, setDurationLoading] = useState(false);

  async function loadDuration() {
    if (durationSeconds !== null || durationLoading) return;
    setDurationLoading(true);
    const paths = crate.paths;
    let total = 0;
    let cursor = 0;

    async function worker() {
      while (cursor < paths.length) {
        const i = cursor++;
        const handle = await getFileHandleForPath(rootHandle, paths[i]);
        if (!handle) continue;
        try {
          const file = await handle.getFile();
          const url = URL.createObjectURL(file);
          const seconds = await new Promise<number>((resolve) => {
            const audio = new Audio();
            audio.preload = "metadata";
            audio.onloadedmetadata = () => resolve(Number.isFinite(audio.duration) ? audio.duration : 0);
            audio.onerror = () => resolve(0);
            audio.src = url;
          });
          URL.revokeObjectURL(url);
          total += seconds;
        } catch {
          // skip unreadable file
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(DURATION_CONCURRENCY, paths.length) }, worker));
    setDurationSeconds(total);
    setDurationLoading(false);
  }

  return (
    <div className="rounded-xl border border-black/8 bg-panel/40">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <BarChart3 size={13} /> Crate Balance Overview
          <NewBadge />
        </span>
        {expanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
      </button>

      {expanded && (
        <div className="border-t border-black/8 p-3">
          {!tracks ? (
            <p className="text-xs text-muted">Analyzing {crate.paths.length} tracks…</p>
          ) : (
            <BalanceBody tracks={tracks} totalPaths={crate.paths.length}
              durationSeconds={durationSeconds} durationLoading={durationLoading} onLoadDuration={loadDuration} />
          )}
        </div>
      )}
    </div>
  );
}

function BalanceBody({
  tracks, totalPaths, durationSeconds, durationLoading, onLoadDuration,
}: {
  tracks: ResolvedTrack[];
  totalPaths: number;
  durationSeconds: number | null;
  durationLoading: boolean;
  onLoadDuration: () => void;
}) {
  const genreCounts = new Map<string, number>();
  const yearBuckets = new Map<string, number>();
  let explicitCount = 0;
  let cleanCount = 0;
  let eliteCount = 0;
  let provenCount = 0;
  let newCount = 0;
  let singalongCount = 0;
  let peakCount = 0;
  let slowCount = 0;
  let transitionCount = 0;

  for (const t of tracks) {
    if (t.genre) genreCounts.set(t.genre, (genreCounts.get(t.genre) ?? 0) + 1);
    if (t.year) {
      const decade = `${Math.floor(t.year / 10) * 10}s`;
      yearBuckets.set(decade, (yearBuckets.get(decade) ?? 0) + 1);
    }
    if (t.contentRating === "Explicit") explicitCount++;
    if (t.contentRating === "Clean" || t.contentRating === "Super Clean" || t.contentRating === "Radio Edit") cleanCount++;
    if (t.crateStatus === "Elite") eliteCount++;
    if (t.crateStatus === "Proven") provenCount++;
    if (t.crateStatus === "New" || !t.crateStatus) newCount++;
    if (t.songFunctions.includes("Singalong")) singalongCount++;
    if (t.songFunctions.includes("Peak Energy")) peakCount++;
    if (t.songFunctions.includes("Slow Dance")) slowCount++;
    if (t.songFunctions.includes("Transition Song") || t.songFunctions.includes("BPM Switch")) transitionCount++;
  }

  const genreSegments = [...genreCounts.entries()].map(([label, value]) => ({ label, value }));
  const decadeSegments = [...yearBuckets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, value]) => ({ label, value }));
  const energySegments = (() => {
    const levelCounts = new Map<string, number>();
    for (const t of tracks) {
      const { label } = energyScoreToLevel(t.energyScore);
      levelCounts.set(label, (levelCounts.get(label) ?? 0) + 1);
    }
    return [...levelCounts.entries()].map(([label, value]) => ({ label, value }));
  })();

  return (
    <div className="flex flex-col gap-4 text-xs">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Total Songs" value={String(totalPaths)} />
        <Stat
          label="Total Playtime"
          value={durationSeconds !== null ? formatDuration(durationSeconds) : durationLoading ? "Loading…" : "—"}
          action={durationSeconds === null && !durationLoading ? { label: "Calculate", onClick: onLoadDuration } : undefined}
        />
        <Stat label="Elite Songs" value={String(eliteCount)} />
        <Stat label="Proven Songs" value={String(provenCount)} />
        <Stat label="New / Untested" value={String(newCount)} />
        <Stat label="Clean" value={String(cleanCount)} />
        <Stat label="Explicit" value={String(explicitCount)} />
        <Stat label="Singalongs" value={String(singalongCount)} />
        <Stat label="Peak Energy" value={String(peakCount)} />
        <Stat label="Slow Songs" value={String(slowCount)} />
        <Stat label="Transitions" value={String(transitionCount)} />
      </div>

      {genreSegments.length > 0 && (
        <div>
          <p className="mb-1.5 font-semibold uppercase tracking-wide text-muted">Genre Distribution</p>
          <StackedBarChart segments={genreSegments} />
        </div>
      )}

      {decadeSegments.length > 0 && (
        <div>
          <p className="mb-1.5 font-semibold uppercase tracking-wide text-muted">Era Distribution</p>
          <StackedBarChart segments={decadeSegments} />
        </div>
      )}

      {energySegments.length > 0 && (
        <div>
          <p className="mb-1.5 font-semibold uppercase tracking-wide text-muted">Energy Distribution</p>
          <StackedBarChart segments={energySegments} />
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, action }: { label: string; value: string; action?: { label: string; onClick: () => void } }) {
  return (
    <div className="rounded-lg border border-black/8 bg-panel/50 p-2">
      <p className="text-[15px] font-bold">{value}</p>
      <p className="text-[10px] text-muted">{label}</p>
      {action && (
        <button onClick={action.onClick} className="mt-1 text-[10px] font-semibold text-gold hover:underline">
          {action.label}
        </button>
      )}
    </div>
  );
}
