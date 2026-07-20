"use client";

import { useEffect } from "react";
import { ImageOff, Music2, Star } from "lucide-react";
import type { CrateRow } from "@/lib/browser-serato";
import { resolveCrateArt, type CrateArt } from "@/lib/crate-art";
import type { CrateProfileSummary } from "@/lib/crate-profile-types";

/**
 * Album-art style grid of crates (playlist-cover look, like a record
 * pool site's browse page). Cover resolution runs lazily per crate:
 * a previously-uploaded override, then embedded ID3 art, then a Spotify
 * search match, then a placeholder — see lib/crate-art.ts.
 */
export function CrateArtGrid({
  crates,
  rootHandle,
  artMap,
  setArtMap,
  onSelect,
  crateProfiles,
}: {
  crates: CrateRow[];
  rootHandle: FileSystemDirectoryHandle;
  artMap: Record<string, CrateArt>;
  setArtMap: React.Dispatch<React.SetStateAction<Record<string, CrateArt>>>;
  onSelect: (crate: CrateRow) => void;
  crateProfiles?: Record<string, CrateProfileSummary>;
}) {
  useEffect(() => {
    let cancelled = false;
    const CONCURRENCY = 6;
    let cursor = 0;

    async function worker() {
      while (cursor < crates.length) {
        const i = cursor++;
        const c = crates[i];
        if (artMap[c.name]) continue;
        const art = await resolveCrateArt(c, rootHandle);
        if (cancelled) return;
        setArtMap((prev) => ({ ...prev, [c.name]: art }));
      }
    }

    Promise.all(Array.from({ length: Math.min(CONCURRENCY, crates.length) }, worker));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [crates, rootHandle]);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {crates.map((c) => {
        const art = artMap[c.name];
        const profile = crateProfiles?.[c.name.replace(/\.crate$/, "")];
        return (
          <button
            key={c.name}
            onClick={() => onSelect(c)}
            className="group flex flex-col overflow-hidden rounded-xl border border-white/8 bg-panel/40 text-left transition-colors hover:border-gold/40"
          >
            <div className="relative aspect-square w-full overflow-hidden bg-panel">
              {art?.url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={art.url} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted">
                  {art?.source === "none" ? <ImageOff size={28} /> : <Music2 size={28} className="animate-pulse" />}
                </div>
              )}
              <div className="absolute right-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-semibold text-white">
                {c.trackCount} tracks
              </div>
              {art?.source && art.source !== "none" && (
                <div className="absolute left-1.5 top-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/80">
                  {art.source}
                </div>
              )}
              {profile?.is_elite && (
                <div className="absolute bottom-1.5 left-1.5 flex items-center gap-1 rounded-full bg-gold px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black">
                  <Star size={9} /> Elite
                </div>
              )}
            </div>
            <div className="p-2.5">
              <p className="truncate text-sm font-medium">{c.name.replace(/\.crate$/, "")}</p>
              {profile?.category && <p className="truncate text-[10px] text-muted">{profile.category}</p>}
            </div>
          </button>
        );
      })}
    </div>
  );
}
