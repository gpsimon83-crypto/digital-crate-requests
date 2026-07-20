/**
 * Fixed taxonomy lists for Crate Builder Phase 1 (guided setup, song tags,
 * crate categories). Hardcoded constants for now, same pattern as the
 * existing ENERGY_OPTIONS in the library page — admin-manageable custom
 * categories are a later phase, not Phase 1.
 */

export const EVENT_TYPES = [
  "Wedding",
  "Corporate Event",
  "Bar or Club",
  "Private Party",
  "High School Dance",
  "College Event",
  "Sports Event",
  "Holiday Party",
  "Family Event",
  "Community Event",
  "Cocktail Hour",
  "Dinner",
  "Ceremony",
  "Open Format",
  "Custom",
] as const;

export const CROWD_AGE_RANGES = [
  "Under 18",
  "18–24",
  "25–34",
  "35–44",
  "45–54",
  "55+",
  "Mixed Ages",
  "Custom Range",
] as const;

export const CLEAN_MUSIC_OPTIONS = [
  "Clean Only",
  "Clean Preferred",
  "Explicit Allowed",
  "Mixed",
  "Unknown",
] as const;

export const GENRE_TAGS = [
  "Hip-Hop",
  "R&B",
  "Pop",
  "Dance",
  "House",
  "EDM",
  "Rock",
  "Alternative",
  "Country",
  "Latin",
  "Reggaeton",
  "Afrobeats",
  "Amapiano",
  "Dancehall",
  "Reggae",
  "Funk",
  "Disco",
  "Soul",
  "Motown",
  "Jazz",
  "Gospel",
  "Old School",
  "Top 40",
  "Line Dance",
  "Slow Dance",
  "Holiday",
  "Children",
  "Sports",
  "Other",
  "Custom Genre",
] as const;

export const ERA_OPTIONS = [
  "1950s",
  "1960s",
  "1970s",
  "1980s",
  "1990s",
  "2000s",
  "2010s",
  "2020s",
  "Current",
  "Timeless",
  "Unknown",
] as const;

/** 1-10 energy scale display labels — mapped from the existing 0-100
 * heuristic score (energy-heuristic.ts), not a new stored value. */
export const ENERGY_LEVEL_LABELS: { min: number; max: number; label: string }[] = [
  { min: 1, max: 2, label: "Background" },
  { min: 3, max: 4, label: "Warm-Up" },
  { min: 5, max: 6, label: "Groove" },
  { min: 7, max: 8, label: "Build" },
  { min: 9, max: 9, label: "Peak" },
  { min: 10, max: 10, label: "Weapon" },
];

export function energyScoreToLevel(score: number): { level: number; label: string } {
  const level = Math.min(10, Math.max(1, Math.round(score / 10) || 1));
  const bucket = ENERGY_LEVEL_LABELS.find((b) => level >= b.min && level <= b.max);
  return { level, label: bucket?.label ?? "Groove" };
}

export const SONG_FUNCTIONS = [
  "Background",
  "Cocktail",
  "Dinner",
  "Warm-Up",
  "Groove",
  "Build",
  "Peak Energy",
  "Dance Floor Opener",
  "Singalong",
  "Slow Dance",
  "Line Dance",
  "Group Dance",
  "Reset Song",
  "Transition Song",
  "BPM Switch",
  "Closing Song",
  "Last Dance",
  "Grand Entrance",
  "Wedding Party Entrance",
  "First Dance",
  "Parent Dance",
  "Cake Cutting",
  "Bouquet Toss",
  "Garter Toss",
  "Anniversary Dance",
  "Sports Hype",
  "Pregame",
  "Victory",
  "Celebration",
  "Crowd Participation",
  "Request Favorite",
  "Emergency Floor Saver",
  "DJ Tool",
  "Other",
] as const;

export const CROWD_FIT_TAGS = [
  "Gen Alpha",
  "Gen Z",
  "Millennials",
  "Gen X",
  "Baby Boomers",
  "Family Friendly",
  "Teen Crowd",
  "College Crowd",
  "Wedding Crowd",
  "Corporate Crowd",
  "Bar Crowd",
  "Club Crowd",
  "Mixed Crowd",
  "Regional Favorite",
  "Wisconsin Favorite",
  "Venue Specific",
  "Other",
] as const;

export const VOCAL_REACTION_TYPES = [
  "Female Singalong",
  "Male Singalong",
  "Group Singalong",
  "Call and Response",
  "Crowd Chant",
  "Instrumental",
  "Dance Routine",
  "Viral",
  "Nostalgic",
  "Romantic",
  "High Emotion",
  "Aggressive",
  "Feel Good",
  "Party Anthem",
  "Other",
] as const;

export const CONTENT_RATINGS = [
  "Clean",
  "Super Clean",
  "Radio Edit",
  "Explicit",
  "Instrumental",
  "Unknown",
] as const;

export const CRATE_STATUSES = [
  "New",
  "Review Needed",
  "Tested",
  "Proven",
  "Elite",
  "Trending",
  "Seasonal",
  "Retired",
  "Do Not Play",
] as const;

export const CRATE_CATEGORIES = [
  "Elite Crates",
  "Event Crates",
  "Genre Crates",
  "Era Crates",
  "Energy Crates",
  "Venue Crates",
  "DJ Tool Crates",
  "Request-Based Crates",
  "Seasonal Crates",
  "Personal DJ Crates",
  "Shared Team Crates",
  "Archived Crates",
] as const;

export const ELITE_CRATE_CATEGORIES = [
  "Elite Instant Dance Floor",
  "Elite Wedding Weapons",
  "Elite Hip-Hop",
  "Elite R&B",
  "Elite Pop",
  "Elite Dance",
  "Elite Rock",
  "Elite Country",
  "Elite Latin",
  "Elite Afrobeats",
  "Elite Throwbacks",
  "Elite 90s",
  "Elite 2000s",
  "Elite Current Hits",
  "Elite Singalongs",
  "Elite Slow Dances",
  "Elite Clean",
  "Elite Corporate",
  "Elite Bar and Club",
  "Elite Wild Cards",
] as const;

/** Energy Flow ordering sections (spec section 9) — distinct from the
 * Energy Crates sub-category suggestions below, which label whole crates
 * rather than track positions within one crate. */
export const ENERGY_FLOW_SECTIONS = [
  "Arrival / Background",
  "Warm-Up",
  "Groove",
  "Build",
  "Peak",
  "Reset",
  "Rebuild",
  "Final Peak",
  "Closing",
  "Last Dance",
] as const;

export const ENERGY_CRATE_SUBCATEGORIES = [
  "Background",
  "Warm-Up",
  "Groove",
  "Build",
  "Peak",
  "Weapons",
  "Reset Songs",
  "Closers",
] as const;

export const FEEDBACK_TAGS = [
  "Worked Well",
  "Average Reaction",
  "Did Not Work",
  "Strong Opener",
  "Strong Peak Song",
  "Strong Reset Song",
  "Good Singalong",
  "Good Transition",
  "Venue Favorite",
  "Event Favorite",
  "Overplayed",
  "Retire Song",
  "Needs Better Edit",
] as const;

export const DJ_TOOL_CRATE_SUBCATEGORIES = [
  "Openers",
  "Transition Tracks",
  "BPM Switches",
  "Acapellas",
  "Instrumentals",
  "Intro Edits",
  "Quick Hits",
  "Clean Edits",
  "Mashups",
  "Remixes",
  "Emergency Songs",
  "Floor Savers",
] as const;
