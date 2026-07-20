"use client";

import { useEffect, useRef, useState } from "react";
import { X, Play, Pause, ImagePlus, Tag, Star } from "lucide-react";
import type { CrateRow } from "@/lib/browser-serato";
import { crateCoverSection, getFileHandleForPath, type CrateArt } from "@/lib/crate-art";
import { errorMessage } from "@/lib/error-message";
import { useMasterPlayer } from "@/components/dashboard/master-player";
import { TrackTagEditor } from "@/components/dashboard/track-tag-editor";
import { CrateBalanceOverview } from "@/components/dashboard/crate-balance-overview";
import { CrateScorePanel } from "@/components/dashboard/crate-score-panel";
import { EnergyFlowEditor } from "@/components/dashboard/energy-flow-editor";
import { SuggestedSongs } from "@/components/dashboard/suggested-songs";
import { resolveArtistTitle, normalizeTrackKey } from "@/lib/energy-heuristic";
import { ELITE_CRATE_CATEGORIES } from "@/lib/crate-taxonomy";
import { NewBadge } from "@/components/dashboard/new-badge";
import { resolveCrateTracks, type ResolvedTrack } from "@/lib/crate-track-resolver";
import type { EnrichedTrack } from "@/lib/smart-crates";
import type { GuidedSetup } from "@/components/dashboard/guided-crate-setup";
import type { CrateProfileSummary } from "@/lib/crate-profile-types";

function trackLabel(path: string): string {
  const name = path.split("/").pop() ?? path;
  return name.replace(/\.[a-zA-Z0-9]+$/, "");
}

function trackKey(path: string): string {
  const { artist, title } = resolveArtistTitle(null, null, trackLabel(path));
  return normalizeTrackKey(artist, title);
}

type Tab = "tracks" | "suggestions" | "energy" | "analysis";

/** In-page "landing page" for a single crate: cover art (with manual
 * override upload), tabbed Tracks/Suggestions/Energy Flow/Analysis views,
 * and per-track preview playback. Resolves the crate's tracks (ID3 + tags)
 * exactly once and shares the result across every tab. */
export function CrateDetailView({
  crate,
  art,
  rootHandle,
  profile,
  isStaff,
  enrichedTracks,
  guidedSetup,
  onClose,
  onArtUpdated,
  onProfileUpdated,
  onCrateRebuilt,
}: {
  crate: CrateRow;
  art: CrateArt | undefined;
  rootHandle: FileSystemDirectoryHandle;
  profile?: CrateProfileSummary;
  isStaff?: boolean;
  enrichedTracks: EnrichedTrack[] | null;
  guidedSetup: GuidedSetup | null;
  onClose: () => void;
  onArtUpdated: (url: string) => void;
  onProfileUpdated?: (profile: CrateProfileSummary) => void;
  onCrateRebuilt: () => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taggingPath, setTaggingPath] = useState<string | null>(null);
  const [eliteSaving, setEliteSaving] = useState(false);
  const [tab, setTab] = useState<Tab>("tracks");
  const [resolvedTracks, setResolvedTracks] = useState<ResolvedTrack[] | null>(null);
  // Which crate `resolvedTracks` belongs to, so stale data from the
  // previous crate can be told apart from "loaded" without synchronously
  // resetting state inside the effect body (avoids a cascading-render
  // footgun — see react-hooks/set-state-in-effect).
  const [resolvedForName, setResolvedForName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const player = useMasterPlayer();

  const canEditElite = isStaff; // Phase 1: staff-only; owner-editing handled server-side too

  useEffect(() => {
    let cancelled = false;
    resolveCrateTracks(crate, rootHandle).then((tracks) => {
      if (cancelled) return;
      setResolvedTracks(tracks);
      setResolvedForName(crate.name);
    });
    return () => {
      cancelled = true;
    };
  }, [crate, rootHandle]);

  const displayTracks = resolvedForName === crate.name ? resolvedTracks : null;

  async function toggleElite() {
    if (!canEditElite) return;
    setEliteSaving(true);
    setError(null);
    try {
      const nextElite = !profile?.is_elite;
      const eliteCategory = nextElite ? (profile?.elite_category ?? ELITE_CRATE_CATEGORIES[0]) : null;
      const res = await fetch("/api/dj/library/crate-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: crate.name.replace(/\.crate$/, ""),
          isElite: nextElite,
          eliteCategory,
          isShared: nextElite ? true : (profile?.is_shared ?? false),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update Elite status");
      onProfileUpdated?.({
        category: data.profile.category, is_elite: data.profile.is_elite,
        elite_category: data.profile.elite_category, is_shared: data.profile.is_shared,
        energy_sections: data.profile.energy_sections ?? [], dismissed_keys: data.profile.dismissed_keys ?? [],
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setEliteSaving(false);
    }
  }

  async function saveProfileField(patch: Record<string, unknown>) {
    try {
      const res = await fetch("/api/dj/library/crate-profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: crate.name.replace(/\.crate$/, ""), ...patch }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");
      onProfileUpdated?.({
        category: data.profile.category, is_elite: data.profile.is_elite,
        elite_category: data.profile.elite_category, is_shared: data.profile.is_shared,
        energy_sections: data.profile.energy_sections ?? [], dismissed_keys: data.profile.dismissed_keys ?? [],
      });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("section", crateCoverSection(crate.name));
      form.append("photo", file);
      const res = await fetch("/api/dj/library/photos", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onArtUpdated(data.photo.url);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function togglePreview(path: string) {
    try {
      const handle = await getFileHandleForPath(rootHandle, path);
      if (!handle) throw new Error("Track file not found on disk.");
      const file = await handle.getFile();
      await player.play(path, trackLabel(path), file);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const TABS: { id: Tab; label: string }[] = [
    { id: "tracks", label: "Tracks" },
    { id: "suggestions", label: "Suggestions" },
    { id: "energy", label: "Energy Flow" },
    { id: "analysis", label: "Analysis" },
  ];

  return (
    <div className="glass-card flex flex-col gap-4 p-4">
      <div className="flex items-start gap-4">
        <div className="relative size-28 shrink-0 overflow-hidden rounded-xl bg-panel">
          {art?.url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={art.url} alt="" className="h-full w-full object-cover" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 truncate text-lg font-bold">
            {crate.name.replace(/\.crate$/, "")}
            {profile?.is_elite && (
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase text-black">
                <Star size={10} /> {profile.elite_category ?? "Elite"}
              </span>
            )}
          </p>
          <p className="text-xs text-muted">{crate.trackCount} tracks{profile?.category ? ` · ${profile.category}` : ""}</p>
          {canEditElite && (
            <span className="mt-2 mr-2 inline-flex items-center gap-1.5">
              <button
                onClick={toggleElite}
                disabled={eliteSaving}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold disabled:opacity-40 ${
                  profile?.is_elite ? "border-gold bg-gold/10 text-gold" : "border-white/12 text-muted hover:border-gold/40 hover:text-gold"
                }`}
              >
                <Star size={13} /> {eliteSaving ? "Saving…" : profile?.is_elite ? "Elite (Shared)" : "Mark as Elite"}
              </button>
              <NewBadge />
            </span>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleUpload(f);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mt-2 flex items-center gap-1.5 rounded-full border border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-40"
          >
            <ImagePlus size={13} /> {uploading ? "Uploading…" : "Upload Cover"}
          </button>
        </div>
        <button onClick={onClose} className="shrink-0 rounded-full p-2 text-muted hover:text-foreground" title="Close">
          <X size={18} />
        </button>
      </div>

      {error && <p className="text-xs text-status-declined">{error}</p>}

      <div className="flex flex-wrap gap-1.5 border-b border-white/8 pb-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full border px-3 py-1.5 text-xs font-medium ${
              tab === t.id ? "border-gold bg-gold/10 text-gold" : "border-white/12 text-muted hover:border-white/25 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "tracks" && (
        <>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Tracks <span className="normal-case text-muted/70">— tap the tag icon to categorize a song</span>
            <NewBadge />
          </p>
          <div className="max-h-96 overflow-y-auto rounded-xl border border-white/8">
            {crate.paths.map((p, i) => {
              const isPlaying = player.isPlaying(p);
              return (
                <div key={`${p}-${i}`} className="flex items-center gap-2 border-b border-white/5 px-3 py-2 text-sm last:border-0 hover:bg-white/5">
                  <button
                    onClick={() => togglePreview(p)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/12 text-muted hover:border-gold/40 hover:text-gold"
                    title="Preview"
                  >
                    {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                  </button>
                  <span className="min-w-0 flex-1 truncate">{trackLabel(p)}</span>
                  <button
                    onClick={() => setTaggingPath(p)}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/12 text-muted hover:border-gold/40 hover:text-gold"
                    title="Tag Song"
                  >
                    <Tag size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </>
      )}

      {tab === "suggestions" && (
        <SuggestedSongs
          crate={crate}
          rootHandle={rootHandle}
          resolvedTracks={displayTracks}
          enrichedTracks={enrichedTracks}
          guidedSetup={guidedSetup}
          dismissedKeys={profile?.dismissed_keys ?? []}
          onDismissedUpdated={(keys) => saveProfileField({ dismissedKeys: keys })}
          onSongAdded={onCrateRebuilt}
        />
      )}

      {tab === "energy" && (
        !displayTracks ? <p className="text-xs text-muted">Analyzing…</p> : (
          <EnergyFlowEditor
            crate={crate}
            rootHandle={rootHandle}
            tracks={displayTracks}
            savedSections={profile?.energy_sections ?? []}
            onSectionsSaved={(sections) => saveProfileField({ energySections: sections })}
            onCrateRebuilt={onCrateRebuilt}
          />
        )
      )}

      {tab === "analysis" && (
        <div className="flex flex-col gap-3">
          <CrateScorePanel tracks={displayTracks} guidedSetup={guidedSetup} />
          <CrateBalanceOverview crate={crate} rootHandle={rootHandle} tracks={displayTracks} />
        </div>
      )}

      {taggingPath && (
        <TrackTagEditor trackKey={trackKey(taggingPath)} label={trackLabel(taggingPath)} onClose={() => setTaggingPath(null)} />
      )}
    </div>
  );
}
