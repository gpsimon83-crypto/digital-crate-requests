import type { ResolvedTrack } from "@/lib/crate-track-resolver";
import type { GuidedSetup } from "@/components/dashboard/guided-crate-setup";
import { energyScoreToLevel } from "@/lib/crate-taxonomy";

export interface ScoreCategory {
  label: string;
  score: number; // 0-100
  recommendations: string[];
}

export interface CrateScoreResult {
  overall: number;
  categories: ScoreCategory[];
}

const AGE_TO_CROWD_FIT: Record<string, string[]> = {
  "Under 18": ["Gen Alpha", "Gen Z", "Teen Crowd"],
  "18–24": ["Gen Z", "College Crowd"],
  "25–34": ["Millennials"],
  "35–44": ["Millennials", "Gen X"],
  "45–54": ["Gen X"],
  "55+": ["Baby Boomers"],
  "Mixed Ages": ["Mixed Crowd", "Family Friendly"],
};

function round(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Crate Score — guidance only, never blocks saving or exporting a crate.
 * Every category returns human-readable recommendations, not just a
 * number, so a DJ can act on it directly. */
export function computeCrateScore(tracks: ResolvedTrack[], guidedSetup: GuidedSetup | null): CrateScoreResult {
  if (tracks.length === 0) {
    return { overall: 0, categories: [] };
  }
  const total = tracks.length;
  const categories: ScoreCategory[] = [];

  // Clean Music Compliance
  {
    const explicit = tracks.filter((t) => t.contentRating === "Explicit");
    const requirement = guidedSetup?.cleanRequirement;
    let score = 100;
    const recs: string[] = [];
    if (requirement === "Clean Only" || requirement === "Clean Preferred") {
      score = round(100 - (explicit.length / total) * 100);
      if (explicit.length > 0) {
        recs.push(`${explicit.length} song(s) are explicit but this event is marked "${requirement}".`);
      }
    } else if (explicit.length > 0 && !requirement) {
      recs.push(`${explicit.length} song(s) are tagged Explicit — set a Clean Music Requirement in Guided Setup if this matters for this event.`);
    }
    categories.push({ label: "Clean Music Compliance", score, recommendations: recs });
  }

  // Genre Balance
  {
    const preferred = guidedSetup?.preferredGenres ?? [];
    const recs: string[] = [];
    let score: number;
    if (preferred.length > 0) {
      const matching = tracks.filter((t) => t.genre && preferred.includes(t.genre)).length;
      score = round((matching / total) * 100);
      const present = new Set(tracks.map((t) => t.genre).filter((g): g is string => !!g));
      const missing = preferred.filter((g) => !present.has(g));
      if (missing.length > 0) recs.push(`Missing preferred genre(s): ${missing.join(", ")}.`);
    } else {
      const uniqueGenres = new Set(tracks.map((t) => t.genre).filter(Boolean)).size;
      score = round(Math.min(100, uniqueGenres * 15));
      if (uniqueGenres <= 1) recs.push("This crate leans heavily on one genre — add variety if the crowd is mixed.");
    }
    categories.push({ label: "Genre Balance", score, recommendations: recs });
  }

  // Era Balance
  {
    const preferred = guidedSetup?.preferredEras ?? [];
    const recs: string[] = [];
    let score: number;
    if (preferred.length > 0) {
      const matching = tracks.filter((t) => {
        if (!t.year) return false;
        const era = `${Math.floor(t.year / 10) * 10}s`;
        return preferred.includes(era) || preferred.includes("Current") || preferred.includes("Timeless");
      }).length;
      score = round((matching / total) * 100);
      if (score < 60) recs.push(`Fewer than 60% of songs match your preferred era(s): ${preferred.join(", ")}.`);
    } else {
      const uniqueEras = new Set(tracks.filter((t) => t.year).map((t) => `${Math.floor(t.year! / 10) * 10}s`)).size;
      score = round(Math.min(100, uniqueEras * 20));
    }
    categories.push({ label: "Era Balance", score, recommendations: recs });
  }

  // Energy Flow (coverage across levels)
  {
    const levels = new Set(tracks.map((t) => energyScoreToLevel(t.energyScore).label));
    const expected = ["Warm-Up", "Groove", "Build", "Peak"];
    const covered = expected.filter((l) => levels.has(l));
    const score = round((covered.length / expected.length) * 100);
    const recs: string[] = [];
    const missing = expected.filter((l) => !levels.has(l));
    if (missing.length > 0) recs.push(`No songs at these energy levels yet: ${missing.join(", ")}.`);
    categories.push({ label: "Energy Flow", score, recommendations: recs });
  }

  // Crowd Fit
  {
    const ageRange = guidedSetup?.crowdAgeRange;
    const expectedTags = ageRange ? AGE_TO_CROWD_FIT[ageRange] : undefined;
    const recs: string[] = [];
    let score: number;
    if (expectedTags && expectedTags.length > 0) {
      const matching = tracks.filter((t) => t.crowdFit.some((c) => expectedTags.includes(c))).length;
      score = round((matching / total) * 100);
      if (score < 50) recs.push(`Fewer than half your songs are tagged for a "${ageRange}" crowd — tag more songs or add ones that fit.`);
    } else {
      score = 100;
    }
    categories.push({ label: "Crowd Fit", score, recommendations: recs });
  }

  // Proven Song Coverage
  {
    const proven = tracks.filter((t) => t.crateStatus === "Proven" || t.crateStatus === "Elite").length;
    const score = round((proven / total) * 100);
    const recs: string[] = [];
    if (score < 30) recs.push("Fewer than 30% of songs are marked Proven or Elite — tag your reliable songs so this improves over time.");
    categories.push({ label: "Proven Song Coverage", score, recommendations: recs });
  }

  // Transition Strength
  {
    const transitions = tracks.filter((t) => t.songFunctions.includes("Transition Song") || t.songFunctions.includes("BPM Switch")).length;
    const score = round(Math.min(100, transitions * 25));
    const recs: string[] = [];
    if (transitions === 0) recs.push("Add at least one Transition Song or BPM Switch to help move between sections smoothly.");
    categories.push({ label: "Transition Strength", score, recommendations: recs });
  }

  // Crate Variety (artist repetition)
  {
    const artistCounts = new Map<string, number>();
    for (const t of tracks) {
      if (!t.artist) continue;
      artistCounts.set(t.artist, (artistCounts.get(t.artist) ?? 0) + 1);
    }
    const maxRepeat = Math.max(0, ...artistCounts.values());
    const overRepresented = [...artistCounts.entries()].filter(([, c]) => c / total > 0.15);
    const score = maxRepeat > 0 ? round(100 - Math.max(0, (maxRepeat / total) * 100 - 15)) : 100;
    const recs: string[] = [];
    if (overRepresented.length > 0) {
      recs.push(`Too many songs from the same artist: ${overRepresented.map(([a, c]) => `${a} (${c})`).join(", ")}.`);
    }
    categories.push({ label: "Crate Variety", score, recommendations: recs });
  }

  // Event Fit — composite of everything else, weighted toward the fields
  // the DJ actually told us about via Guided Setup.
  {
    const others = categories.filter((c) => c.label !== "Event Fit");
    const score = round(others.reduce((sum, c) => sum + c.score, 0) / others.length);
    categories.splice(1, 0, { label: "Event Fit", score, recommendations: [] });
  }

  const overall = round(categories.reduce((sum, c) => sum + c.score, 0) / categories.length);
  return { overall, categories };
}
