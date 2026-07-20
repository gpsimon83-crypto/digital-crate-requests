/**
 * There is no real, measured "energy" data available to this project —
 * Spotify's audio-features endpoint (which used to provide this) returns
 * 403 for this app (verified directly: Spotify restricted it for new API
 * apps in late 2024). This is a heuristic estimate only, built from BPM +
 * genre keywords + filename hints, clearly surfaced as an estimate in the
 * UI so DJs know to sanity-check it rather than trust it blindly.
 */

export type EnergyTier = "warmup" | "smooth" | "moderate" | "high_energy" | "unknown";

const SMOOTH_GENRE_KEYWORDS = [
  "jazz", "smooth", "acoustic", "soul", "r&b", "rnb", "lounge", "chill",
  "ambient", "classical", "soundtrack", "ballad", "slow jam",
];
const HIGH_ENERGY_GENRE_KEYWORDS = [
  "edm", "house", "electro", "dance", "hardstyle", "trap", "dubstep",
  "techno", "hyperpop", "drum & bass", "dnb", "hardcore",
];
const HIGH_ENERGY_FILENAME_KEYWORDS = [
  "redrum", "banger", "anthem", "hype", "hype intro", "festival",
  "rage", "bootleg", "mashup", "extended mix",
];
const SMOOTH_FILENAME_KEYWORDS = ["chill", "acoustic version", "unplugged", "slow", "intro clean"];

// Standard ID3v1 genre code table (indices 0-79 are the original spec;
// 80+ are the widely-adopted WinAmp extension). Old tagging tools used by
// several DJ record pools write genre as "(N)" or "(N)Name" literally
// into the ID3v2 TCON text frame — verified directly against real files
// on this drive (e.g. "(128)Club-House", bare "(112)").
const ID3V1_GENRES = [
  "Blues", "Classic Rock", "Country", "Dance", "Disco", "Funk", "Grunge", "Hip-Hop",
  "Jazz", "Metal", "New Age", "Oldies", "Other", "Pop", "R&B", "Rap", "Reggae", "Rock",
  "Techno", "Industrial", "Alternative", "Ska", "Death Metal", "Pranks", "Soundtrack",
  "Euro-Techno", "Ambient", "Trip-Hop", "Vocal", "Jazz+Funk", "Fusion", "Trance",
  "Classical", "Instrumental", "Acid", "House", "Game", "Sound Clip", "Gospel", "Noise",
  "Alternative Rock", "Bass", "Soul", "Punk", "Space", "Meditative", "Instrumental Pop",
  "Instrumental Rock", "Ethnic", "Gothic", "Darkwave", "Techno-Industrial", "Electronic",
  "Pop-Folk", "Eurodance", "Dream", "Southern Rock", "Comedy", "Cult", "Gangsta", "Top 40",
  "Christian Rap", "Pop/Funk", "Jungle", "Native US", "Cabaret", "New Wave", "Psychedelic",
  "Rave", "Showtunes", "Trailer", "Lo-Fi", "Tribal", "Acid Punk", "Acid Jazz", "Polka",
  "Retro", "Musical", "Rock & Roll", "Hard Rock", "Folk", "Folk-Rock", "National Folk",
  "Swing", "Fast Fusion", "Bebop", "Latin", "Revival", "Celtic", "Bluegrass", "Avantgarde",
  "Gothic Rock", "Progressive Rock", "Psychedelic Rock", "Symphonic Rock", "Slow Rock",
  "Big Band", "Chorus", "Easy Listening", "Acoustic", "Humour", "Speech", "Chanson",
  "Opera", "Chamber Music", "Sonata", "Symphony", "Booty Bass", "Primus", "Porn Groove",
  "Satire", "Slow Jam", "Club", "Tango", "Samba", "Folklore", "Ballad", "Power Ballad",
  "Rhythmic Soul", "Freestyle", "Duet", "Punk Rock", "Drum Solo", "A Cappella", "Euro-House",
  "Dance Hall", "Goa", "Drum & Bass", "Club-House", "Hardcore", "Terror", "Indie",
  "BritPop", "Negerpunk", "Polsk Punk", "Beat", "Christian Gangsta Rap", "Heavy Metal",
  "Black Metal", "Crossover", "Contemporary Christian", "Christian Rock", "Merengue",
  "Salsa", "Thrash Metal", "Anime", "JPop", "Synthpop",
];

function cleanGenre(rawGenre: string | null): string {
  if (!rawGenre) return "";
  let s = rawGenre.replace(/\[[^\]]*\]/g, "").trim(); // strip promo tags like "Club [DJ Mebbe]"

  const paren = s.match(/^\((\d+)\)\s*(.*)$/);
  if (paren) {
    const [, codeStr, rest] = paren;
    if (rest.trim()) {
      s = rest.trim(); // "(128)Club-House" -> "Club-House"
    } else {
      const code = parseInt(codeStr, 10);
      s = ID3V1_GENRES[code] ?? ""; // bare "(112)" -> looked-up name, or unknown
    }
  } else if (/^\d+$/.test(s)) {
    // Some taggers wrote the ID3v1 numeric code with no parens at all, e.g. TCON="13"
    s = ID3V1_GENRES[parseInt(s, 10)] ?? "";
  }

  return s.trim().toLowerCase();
}

const MIN_SANE_YEAR = 1930;
const MAX_SANE_YEAR = new Date().getFullYear() + 1;

/** Filters out clearly-garbage years (misparsed frames, corrupted tags)
 * rather than surfacing nonsense decades like "7780s" in the UI. */
export function sanitizeYear(year: number | null): number | null {
  if (year === null) return null;
  return year >= MIN_SANE_YEAR && year <= MAX_SANE_YEAR ? year : null;
}

export interface EnergyEstimate {
  tier: EnergyTier;
  score: number; // 0-100, heuristic only
}

export function estimateEnergy(params: { bpm: number | null; genre: string | null; filename: string }): EnergyEstimate {
  const genre = cleanGenre(params.genre);
  const filename = params.filename.toLowerCase();
  let score = 50; // neutral baseline
  let hasSignal = false;

  if (params.bpm && params.bpm >= 40 && params.bpm <= 220) {
    hasSignal = true;
    if (params.bpm < 95) score -= 20;
    else if (params.bpm < 110) score -= 8;
    else if (params.bpm > 145) score += 25;
    else if (params.bpm > 125) score += 15;
    else score += 2;
  }

  if (genre) {
    if (SMOOTH_GENRE_KEYWORDS.some((k) => genre.includes(k))) {
      score -= 20;
      hasSignal = true;
    }
    if (HIGH_ENERGY_GENRE_KEYWORDS.some((k) => genre.includes(k))) {
      score += 20;
      hasSignal = true;
    }
  }

  if (HIGH_ENERGY_FILENAME_KEYWORDS.some((k) => filename.includes(k))) {
    score += 10;
    hasSignal = true;
  }
  if (SMOOTH_FILENAME_KEYWORDS.some((k) => filename.includes(k))) {
    score -= 10;
    hasSignal = true;
  }

  if (!hasSignal) return { tier: "unknown", score: 50 };

  score = Math.max(0, Math.min(100, score));
  let tier: EnergyTier;
  if (score < 30) tier = "warmup";
  else if (score < 45) tier = "smooth";
  else if (score < 65) tier = "moderate";
  else tier = "high_energy";

  return { tier, score };
}

export function cleanGenreLabel(rawGenre: string | null): string | null {
  const cleaned = cleanGenre(rawGenre);
  return cleaned ? cleaned.replace(/\b\w/g, (c) => c.toUpperCase()) : null;
}

/** Some pool-tagged files put a promo tag in the artist field (e.g.
 * "[DJ Mebbe]") and bake the real "Artist - Title" into the title field
 * instead — verified against real files on this drive. Detect and fix. */
export function resolveArtistTitle(id3Artist: string | null, id3Title: string | null, filename: string): { artist: string; title: string } {
  const looksLikePromoTag = (s: string | null) => !!s && /^\[.*\]$/.test(s.trim());

  if (id3Title && id3Title.includes(" - ") && (looksLikePromoTag(id3Artist) || !id3Artist)) {
    const idx = id3Title.indexOf(" - ");
    return { artist: id3Title.slice(0, idx).trim(), title: id3Title.slice(idx + 3).trim() };
  }
  if (id3Artist && !looksLikePromoTag(id3Artist) && id3Title) {
    return { artist: id3Artist, title: id3Title };
  }

  // Fall back to filename "Artist - Title.ext"
  const stem = filename.replace(/\.[a-z0-9]+$/i, "");
  if (stem.includes(" - ")) {
    const idx = stem.indexOf(" - ");
    return { artist: stem.slice(0, idx).trim(), title: stem.slice(idx + 3).trim() };
  }
  return { artist: id3Artist ?? "", title: id3Title ?? stem };
}

export function normalizeTrackKey(artist: string, title: string): string {
  const clean = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  return `${clean(artist)}::${clean(title)}`;
}
