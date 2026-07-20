import type { CrateRow } from "@/lib/browser-serato";
import { getFileHandleForPath } from "@/lib/crate-art";
import { readId3Tags } from "@/lib/browser-id3";
import { estimateEnergy, resolveArtistTitle, normalizeTrackKey, cleanGenreLabel, sanitizeYear } from "@/lib/energy-heuristic";

export interface ResolvedTrack {
  key: string;
  path: string;
  label: string;
  artist: string;
  title: string;
  genre: string | null;
  year: number | null;
  bpm: number | null;
  energyScore: number;
  contentRating: string | null;
  crateStatus: string | null;
  songFunctions: string[];
  crowdFit: string[];
}

const RESOLVE_CONCURRENCY = 8;

/**
 * Resolves a crate's tracks once — ID3 read (genre/year/bpm/energy) plus
 * one batched /api/dj/library/tags call for content rating / crate status /
 * song function. Shared by CrateBalanceOverview, CrateScorePanel,
 * EnergyFlowEditor, and SuggestedSongs so a crate is never re-read from
 * disk four times for four different panels.
 */
export async function resolveCrateTracks(
  crate: CrateRow,
  rootHandle: FileSystemDirectoryHandle
): Promise<ResolvedTrack[]> {
  const paths = crate.paths;
  const results: (ResolvedTrack | null)[] = new Array(paths.length).fill(null);
  let cursor = 0;

  async function worker() {
    while (cursor < paths.length) {
      const i = cursor++;
      const handle = await getFileHandleForPath(rootHandle, paths[i]);
      if (!handle) continue;
      try {
        const file = await handle.getFile();
        const tags = await readId3Tags(file);
        const name = paths[i].split("/").pop() ?? paths[i];
        const label = name.replace(/\.[a-zA-Z0-9]+$/, "");
        const { artist, title } = resolveArtistTitle(tags.artist, tags.title, name);
        const key = normalizeTrackKey(artist, title);
        const genre = cleanGenreLabel(tags.genre);
        const { score } = estimateEnergy({ bpm: tags.bpm, genre: tags.genre, filename: name });
        results[i] = {
          key,
          path: paths[i],
          label,
          artist,
          title,
          genre,
          year: sanitizeYear(tags.year),
          bpm: tags.bpm && tags.bpm >= 40 && tags.bpm <= 220 ? Math.round(tags.bpm) : null,
          energyScore: score,
          contentRating: null,
          crateStatus: null,
          songFunctions: [],
          crowdFit: [],
        };
      } catch {
        // unreadable file — skip, doesn't block the rest of the crate
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(RESOLVE_CONCURRENCY, paths.length) }, worker));
  const resolved = results.filter((r): r is ResolvedTrack => r !== null);

  try {
    const keys = resolved.map((r) => r.key);
    if (keys.length > 0) {
      const res = await fetch(`/api/dj/library/tags?keys=${encodeURIComponent(keys.join(","))}`);
      const data = await res.json();
      for (const r of resolved) {
        const t = data.tags?.[r.key];
        if (!t) continue;
        r.contentRating = t.content_rating?.[0] ?? null;
        r.crateStatus = t.crate_status?.[0] ?? null;
        r.songFunctions = t.song_function ?? [];
        r.crowdFit = t.crowd_fit ?? [];
      }
    }
  } catch {
    // tags are additive — callers still work without them
  }

  return resolved;
}
