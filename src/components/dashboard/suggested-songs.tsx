"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Lightbulb, Play, Pause, Plus, EyeOff, Ban } from "lucide-react";
import type { CrateRow } from "@/lib/browser-serato";
import { buildCrateBytes } from "@/lib/browser-serato";
import type { EnrichedTrack } from "@/lib/smart-crates";
import type { ResolvedTrack } from "@/lib/crate-track-resolver";
import type { GuidedSetup } from "@/components/dashboard/guided-crate-setup";
import { energyScoreToLevel } from "@/lib/crate-taxonomy";
import { useMasterPlayer } from "@/components/dashboard/master-player";
import { errorMessage } from "@/lib/error-message";
import { NewBadge } from "@/components/dashboard/new-badge";

interface Suggestion {
  track: EnrichedTrack;
  reason: string;
}

const MAX_PER_BUCKET = 8;
const EXPECTED_ENERGY_LEVELS = ["Warm-Up", "Groove", "Build", "Peak"];

export function SuggestedSongs({
  crate,
  rootHandle,
  resolvedTracks,
  enrichedTracks,
  guidedSetup,
  dismissedKeys,
  onDismissedUpdated,
  onSongAdded,
}: {
  crate: CrateRow;
  rootHandle: FileSystemDirectoryHandle;
  resolvedTracks: ResolvedTrack[] | null;
  enrichedTracks: EnrichedTrack[] | null;
  guidedSetup: GuidedSetup | null;
  dismissedKeys: string[];
  onDismissedUpdated: (keys: string[]) => void;
  onSongAdded: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [sessionDismissed, setSessionDismissed] = useState<Set<string>>(new Set());
  const [ratedKeys, setRatedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const player = useMasterPlayer();

  useEffect(() => {
    fetch("/api/dj/library/ratings")
      .then((r) => r.json())
      .then((d) => {
        const keys = Object.entries(d.ratings ?? {})
          .filter(([, r]) => (r as { stars: number | null }).stars && (r as { stars: number }).stars >= 4)
          .map(([k]) => k);
        setRatedKeys(new Set(keys));
      })
      .catch(() => {});
  }, []);

  if (!resolvedTracks || !enrichedTracks) {
    return <p className="text-xs text-muted">Analyzing…</p>;
  }

  const inCrate = new Set(resolvedTracks.map((t) => t.key));
  const excluded = new Set([...inCrate, ...dismissedKeys, ...sessionDismissed]);
  const candidates = enrichedTracks.filter((t) => !excluded.has(t.key));

  const buckets: { title: string; items: Suggestion[] }[] = [];

  if (guidedSetup) {
    if (guidedSetup.preferredGenres.length > 0) {
      const strong = candidates
        .filter((t) => t.genre && guidedSetup.preferredGenres.includes(t.genre))
        .slice(0, MAX_PER_BUCKET)
        .map((t) => ({ track: t, reason: `Strong match — ${t.genre} fits this crate's preferred genres.` }));
      if (strong.length > 0) buckets.push({ title: "Strong Matches", items: strong });
    }

    const presentGenres = new Set(resolvedTracks.map((t) => t.genre).filter(Boolean));
    const missingGenres = guidedSetup.preferredGenres.filter((g) => !presentGenres.has(g));
    if (missingGenres.length > 0) {
      const items = candidates
        .filter((t) => t.genre && missingGenres.includes(t.genre))
        .slice(0, MAX_PER_BUCKET)
        .map((t) => ({ track: t, reason: `Fills the missing ${t.genre} genre in this crate.` }));
      if (items.length > 0) buckets.push({ title: "Missing Genres", items });
    }

    const presentEras = new Set(resolvedTracks.filter((t) => t.year).map((t) => `${Math.floor(t.year! / 10) * 10}s`));
    const missingEras = guidedSetup.preferredEras.filter((e) => !presentEras.has(e));
    if (missingEras.length > 0) {
      const items = candidates
        .filter((t) => t.year && missingEras.includes(`${Math.floor(t.year / 10) * 10}s`))
        .slice(0, MAX_PER_BUCKET)
        .map((t) => ({ track: t, reason: `Fills the missing ${Math.floor(t.year! / 10) * 10}s era in this crate.` }));
      if (items.length > 0) buckets.push({ title: "Missing Eras", items });
    }
  }

  const presentLevels = new Set(resolvedTracks.map((t) => energyScoreToLevel(t.energyScore).label));
  const missingLevels = EXPECTED_ENERGY_LEVELS.filter((l) => !presentLevels.has(l));
  if (missingLevels.length > 0) {
    const items = candidates
      .filter((t) => missingLevels.includes(energyScoreToLevel(t.energyScore).label))
      .slice(0, MAX_PER_BUCKET)
      .map((t) => ({ track: t, reason: `Adds a needed ${energyScoreToLevel(t.energyScore).label} track — this crate has none yet.` }));
    if (items.length > 0) buckets.push({ title: "Missing Energy Levels", items });
  }

  const proven = candidates
    .filter((t) => t.tags?.crateStatus?.includes("Proven"))
    .slice(0, MAX_PER_BUCKET)
    .map((t) => ({ track: t, reason: "Marked Proven — reliable elsewhere in your library." }));
  if (proven.length > 0) buckets.push({ title: "Proven Songs", items: proven });

  const elite = candidates
    .filter((t) => t.tags?.crateStatus?.includes("Elite"))
    .slice(0, MAX_PER_BUCKET)
    .map((t) => ({ track: t, reason: "Marked Elite in your library." }));
  if (elite.length > 0) buckets.push({ title: "Elite Songs", items: elite });

  const highlyRated = candidates
    .filter((t) => ratedKeys.has(t.key))
    .slice(0, MAX_PER_BUCKET)
    .map((t) => ({ track: t, reason: "You rated this 4-5 stars." }));
  if (highlyRated.length > 0) buckets.push({ title: "Your Highly-Rated Songs", items: highlyRated });

  async function addSong(track: EnrichedTrack) {
    setAddingKey(track.key);
    setError(null);
    try {
      const seratoHandle = await rootHandle.getDirectoryHandle("_Serato_");
      const subcrates = await seratoHandle.getDirectoryHandle("Subcrates", { create: true });
      const newPath = ["MUSIC", ...track.path].join("/");
      const paths = [...crate.paths, newPath];
      const dest = await subcrates.getFileHandle(crate.name, { create: true });
      const writable = await dest.createWritable();
      await writable.write(new Blob([new Uint8Array(buildCrateBytes(paths))]));
      await writable.close();
      onSongAdded();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setAddingKey(null);
    }
  }

  function dismissForSession(key: string) {
    setSessionDismissed((s) => new Set([...s, key]));
  }

  function neverSuggest(key: string) {
    onDismissedUpdated([...dismissedKeys, key]);
  }

  async function preview(track: EnrichedTrack) {
    try {
      const file = await track.handle.getFile();
      await player.play(track.key, `${track.artist} — ${track.resolvedTitle}`, file);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="rounded-xl border border-white/8 bg-panel/40">
      <button onClick={() => setExpanded((e) => !e)} className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          <Lightbulb size={13} /> Suggested Songs <NewBadge />
        </span>
        {expanded ? <ChevronUp size={14} className="text-muted" /> : <ChevronDown size={14} className="text-muted" />}
      </button>

      {expanded && (
        <div className="flex flex-col gap-4 border-t border-white/8 p-3">
          {error && <p className="text-xs text-status-declined">{error}</p>}

          {buckets.length === 0 ? (
            <p className="text-xs text-muted">No suggestions right now — fill out Guided Crate Setup or tag more songs in your library for better matches.</p>
          ) : (
            buckets.map((bucket) => (
              <div key={bucket.title}>
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted">{bucket.title}</p>
                <div className="flex flex-col gap-1.5">
                  {bucket.items.map(({ track, reason }) => {
                    const isPlaying = player.isPlaying(track.key);
                    return (
                      <div key={track.key} className="flex items-center gap-2 rounded-lg border border-white/8 bg-panel/30 px-2.5 py-2 text-xs">
                        <button onClick={() => preview(track)} className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/12 text-muted hover:border-gold/40 hover:text-gold">
                          {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                        </button>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium">{track.artist} — {track.resolvedTitle}</p>
                          <p className="truncate text-muted">{reason}</p>
                        </div>
                        <button
                          onClick={() => addSong(track)}
                          disabled={addingKey !== null}
                          className="flex shrink-0 items-center gap-1 rounded-full border border-gold/40 px-2 py-1 text-[11px] font-semibold text-gold hover:bg-gold/10 disabled:opacity-40"
                          title="Add Song"
                        >
                          <Plus size={11} /> {addingKey === track.key ? "Adding…" : "Add"}
                        </button>
                        <button onClick={() => dismissForSession(track.key)} className="shrink-0 rounded-full p-1.5 text-muted hover:text-foreground" title="Dismiss Suggestion">
                          <EyeOff size={13} />
                        </button>
                        <button onClick={() => neverSuggest(track.key)} className="shrink-0 rounded-full p-1.5 text-muted hover:text-status-declined" title="Never Suggest for This Crate">
                          <Ban size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}

          <p className="text-[10px] text-muted">
            Frequently Requested, Venue Favorites, and Trending suggestions are coming in Phase 3 (need Crate Request / venue-history data not connected yet).
          </p>
        </div>
      )}
    </div>
  );
}
