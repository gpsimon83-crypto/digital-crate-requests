import { readId3Tags } from "@/lib/browser-id3";
import { estimateEnergy, resolveArtistTitle, normalizeTrackKey, cleanGenreLabel, sanitizeYear, type EnergyTier } from "@/lib/energy-heuristic";
import { buildCrateBytes, type AudioFileEntry } from "@/lib/browser-serato";

/** Per-song category tags (from the track_tags table, fetched separately
 * and merged in — see /api/dj/library/tags). Optional/absent means "not
 * loaded yet," not "no tags," so filtering degrades gracefully. */
export interface TrackTags {
  genre?: string[];
  era?: string[];
  songFunction?: string[];
  crowdFit?: string[];
  vocalType?: string[];
  contentRating?: string[]; // single-select in the UI, stored as a 0-1 array
  crateStatus?: string[];   // single-select in the UI, stored as a 0-1 array
}

export interface EnrichedTrack extends AudioFileEntry {
  key: string;
  artist: string;
  resolvedTitle: string;
  genre: string | null;
  year: number | null;
  bpm: number | null;
  energyTier: EnergyTier;
  energyScore: number;
  tags?: TrackTags;
}

const CONCURRENCY = 24;

/** Reads ID3 tags for every file (small header reads only) and computes
 * the local heuristic energy estimate. No network calls in this step. */
export async function enrichFilesLocally(
  files: AudioFileEntry[],
  onProgress?: (done: number, total: number) => void
): Promise<EnrichedTrack[]> {
  const results: EnrichedTrack[] = new Array(files.length);
  let cursor = 0;
  let done = 0;

  async function worker() {
    while (cursor < files.length) {
      const i = cursor++;
      const f = files[i];
      const file = await f.handle.getFile();
      const tags = await readId3Tags(file);
      const { artist, title } = resolveArtistTitle(tags.artist, tags.title, f.name);
      const genre = cleanGenreLabel(tags.genre);
      const { tier, score } = estimateEnergy({ bpm: tags.bpm, genre: tags.genre, filename: f.name });

      const bpm = tags.bpm && tags.bpm >= 40 && tags.bpm <= 220 ? Math.round(tags.bpm) : null;

      results[i] = {
        ...f,
        key: normalizeTrackKey(artist, title),
        artist,
        resolvedTitle: title,
        genre,
        year: sanitizeYear(tags.year),
        bpm,
        energyTier: tier,
        energyScore: score,
      };

      done++;
      if (done % 200 === 0) onProgress?.(done, files.length);
    }
  }

  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, files.length) }, worker));
  onProgress?.(files.length, files.length);
  return results;
}

/** Sends tracks missing a year to the server enrichment agent (Spotify
 * lookup, cached in Supabase). Processes in batches; call repeatedly
 * (each call picks up wherever the shared cache left off) to keep going
 * for very large libraries without one huge blocking request. */
export async function fillMissingYears(
  tracks: EnrichedTrack[],
  onProgress?: (done: number, total: number) => void,
  batchSize = 40,
  maxBatches = 8
): Promise<EnrichedTrack[]> {
  const needsLookup = tracks.filter((t) => !t.year);
  if (needsLookup.length === 0) return tracks;

  const byKey = new Map(tracks.map((t) => [t.key, t]));
  let processed = 0;
  const total = Math.min(needsLookup.length, batchSize * maxBatches);

  for (let b = 0; b < maxBatches; b++) {
    const batch = needsLookup.slice(b * batchSize, (b + 1) * batchSize);
    if (batch.length === 0) break;

    const uniqueByKey = new Map(batch.map((t) => [t.key, t]));
    const payload = [...uniqueByKey.values()].map((t) => ({
      key: t.key,
      artist: t.artist,
      title: t.resolvedTitle,
      genre: t.genre,
      year: t.year,
      energyTier: t.energyTier,
      energyScore: t.energyScore,
    }));

    const res = await fetch("/api/dj/library/enrich", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tracks: payload }),
    });
    if (!res.ok) break;
    const data = await res.json();

    for (const [key, info] of Object.entries(data.results as Record<string, { genre: string | null; year: number | null }>)) {
      const t = byKey.get(key);
      if (t && info.year) t.year = info.year;
    }

    processed += batch.length;
    onProgress?.(processed, total);
  }

  return [...byKey.values()];
}

// Field/operator vocabulary mirrors Serato's own Smart Crate rule builder
// (Genre/BPM/Year with Is/Is Not/Is Greater Than/Is Less Than/Is Between,
// text fields with Contains). We don't write the real Serato Smart Crate
// binary format (unverified, no sample file to test against — see chat),
// so this evaluates rules ourselves and writes a regular static crate.
export type RuleField =
  | "genre" | "year" | "bpm" | "energy" | "artist" | "title"
  | "songFunction" | "crowdFit" | "contentRating" | "crateStatus" | "eliteStatus";
export type RuleComparator =
  | "is" | "is_not" | "contains" | "does_not_contain"
  | "greater_than" | "less_than" | "between";

// Fields backed by a multi-value tag array (track_tags) rather than a
// single scalar — "is"/"is_not" mean "includes"/"does not include".
const ARRAY_TAG_FIELDS: RuleField[] = ["songFunction", "crowdFit"];

export interface SmartRule {
  id: string;
  field: RuleField;
  comparator: RuleComparator;
  value: string;
  value2?: string; // only used for "between"
}

export interface SmartCrateQuery {
  rules: SmartRule[];
  matchType: "all" | "any";
}

export const FIELD_LABELS: Record<RuleField, string> = {
  genre: "Genre", year: "Year", bpm: "BPM", energy: "Energy (estimate)",
  artist: "Artist", title: "Title",
  songFunction: "Song Function", crowdFit: "Crowd Fit",
  contentRating: "Content Rating", crateStatus: "Crate Status (Song)",
  eliteStatus: "Elite Status (Song)",
};

export const NUMERIC_FIELDS: RuleField[] = ["year", "bpm"];
export const TEXT_FIELDS: RuleField[] = ["artist", "title"];
export const ENUM_FIELDS: RuleField[] = ["genre", "energy", "contentRating", "crateStatus", "eliteStatus"];

export const COMPARATORS_FOR_FIELD: Record<RuleField, { value: RuleComparator; label: string }[]> = {
  genre: [{ value: "is", label: "Is" }, { value: "is_not", label: "Is Not" }],
  energy: [{ value: "is", label: "Is" }],
  year: [
    { value: "is", label: "Is" }, { value: "greater_than", label: "Is Greater Than" },
    { value: "less_than", label: "Is Less Than" }, { value: "between", label: "Is Between" },
  ],
  bpm: [
    { value: "is", label: "Is" }, { value: "greater_than", label: "Is Greater Than" },
    { value: "less_than", label: "Is Less Than" }, { value: "between", label: "Is Between" },
  ],
  artist: [{ value: "contains", label: "Contains" }, { value: "does_not_contain", label: "Does Not Contain" }, { value: "is", label: "Is" }],
  title: [{ value: "contains", label: "Contains" }, { value: "does_not_contain", label: "Does Not Contain" }, { value: "is", label: "Is" }],
  songFunction: [{ value: "is", label: "Includes" }, { value: "is_not", label: "Does Not Include" }],
  crowdFit: [{ value: "is", label: "Includes" }, { value: "is_not", label: "Does Not Include" }],
  contentRating: [{ value: "is", label: "Is" }, { value: "is_not", label: "Is Not" }],
  crateStatus: [{ value: "is", label: "Is" }, { value: "is_not", label: "Is Not" }],
  eliteStatus: [{ value: "is", label: "Is" }],
};

function fieldValue(track: EnrichedTrack, field: RuleField): string | number | string[] | null {
  switch (field) {
    case "genre": return track.genre;
    case "year": return track.year;
    case "bpm": return track.bpm;
    case "energy": return track.energyTier;
    case "artist": return track.artist;
    case "title": return track.resolvedTitle;
    case "songFunction": return track.tags?.songFunction ?? [];
    case "crowdFit": return track.tags?.crowdFit ?? [];
    case "contentRating": return track.tags?.contentRating?.[0] ?? null;
    case "crateStatus": return track.tags?.crateStatus?.[0] ?? null;
    case "eliteStatus": return track.tags?.crateStatus?.includes("Elite") ? "yes" : "no";
  }
}

function evaluateRule(track: EnrichedTrack, rule: SmartRule): boolean {
  const actual = fieldValue(track, rule.field);
  if (actual === null || actual === undefined) return false;

  if (ARRAY_TAG_FIELDS.includes(rule.field)) {
    const arr = (Array.isArray(actual) ? actual : []).map((v) => v.toLowerCase());
    const v = rule.value.toLowerCase();
    const includes = arr.includes(v);
    return rule.comparator === "is_not" ? !includes : includes;
  }

  if (NUMERIC_FIELDS.includes(rule.field)) {
    const n = Number(actual);
    const v = parseFloat(rule.value);
    if (Number.isNaN(v)) return false;
    switch (rule.comparator) {
      case "is": return n === v;
      case "greater_than": return n > v;
      case "less_than": return n < v;
      case "between": {
        const v2 = parseFloat(rule.value2 ?? "");
        if (Number.isNaN(v2)) return false;
        return n >= Math.min(v, v2) && n <= Math.max(v, v2);
      }
      default: return false;
    }
  }

  const s = String(actual).toLowerCase();
  const v = rule.value.toLowerCase();
  switch (rule.comparator) {
    case "is": return s === v;
    case "is_not": return s !== v;
    case "contains": return s.includes(v);
    case "does_not_contain": return !s.includes(v);
    default: return false;
  }
}

export function filterTracksByQuery(tracks: EnrichedTrack[], query: SmartCrateQuery): EnrichedTrack[] {
  if (query.rules.length === 0) return tracks;
  return tracks.filter((t) =>
    query.matchType === "all"
      ? query.rules.every((r) => evaluateRule(t, r))
      : query.rules.some((r) => evaluateRule(t, r))
  );
}

// Filters out placeholder/junk genre strings that are metadata artifacts,
// not real genres, so they don't clutter the rule builder's dropdown —
// verified against real values found on this drive (e.g. literal "Genre",
// "None", "Unknown", empty numeric leftovers).
const JUNK_GENRE_VALUES = new Set([
  "genre", "none", "no", "unknown", "<unknown>", "music", "user defined",
  "n/a", "na", "", "other", "misc", "mixtape", "mix tape",
]);

export function availableGenreOptions(tracks: EnrichedTrack[]): string[] {
  const set = new Set<string>();
  for (const t of tracks) {
    if (t.genre && !JUNK_GENRE_VALUES.has(t.genre.toLowerCase())) set.add(t.genre);
  }
  return [...set].sort();
}

/** `musicFolderName` should be the music folder's own name (e.g. "MUSIC"),
 * never the drive's name — Serato's real crate paths are relative to the
 * volume root with no drive-name segment (verified against a real
 * Serato-written crate; see browser-serato.ts's buildCratesFromFolders). */
export async function buildSmartCrate(
  crateName: string,
  matchingTracks: EnrichedTrack[],
  musicFolderName: string,
  subcratesHandle: FileSystemDirectoryHandle
): Promise<{ created: boolean; reason?: string }> {
  const safeName = crateName.replace(/[\\/:*?"<>|]/g, "_");
  const fileName = `${safeName}.crate`;
  try {
    await subcratesHandle.getFileHandle(fileName);
    return { created: false, reason: "A crate with this name already exists." };
  } catch {
    // doesn't exist yet — good
  }

  const paths = matchingTracks.map((t) => [musicFolderName, ...t.path].join("/"));
  const fileHandle = await subcratesHandle.getFileHandle(fileName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(new Blob([new Uint8Array(buildCrateBytes(paths))]));
  await writable.close();
  return { created: true };
}
