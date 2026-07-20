import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { lookupTrackYear } from "@/lib/spotify";
import { errorMessage } from "@/lib/error-message";

interface EnrichRequestTrack {
  key: string; // normalizeTrackKey(artist, title)
  artist: string;
  title: string;
  genre: string | null;
  year: number | null;
  energyTier: string;
  energyScore: number;
}

/**
 * Metadata enrichment agent: for each submitted track, checks the shared
 * Supabase cache first, then (only for tracks missing a year) looks it up
 * via Spotify search and caches the result — so no track is looked up
 * twice across any DJ's computer. Genre is never fabricated: only real
 * ID3-tag genre is stored, since Spotify doesn't provide genre data at
 * this app's API access tier (verified directly against the live API).
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const { tracks } = (await req.json()) as { tracks: EnrichRequestTrack[] };
  if (!Array.isArray(tracks) || tracks.length === 0) {
    return NextResponse.json({ error: "tracks array is required" }, { status: 400 });
  }

  const db = createAdminClient();
  const keys = tracks.map((t) => t.key);

  const { data: cached, error: cacheErr } = await db
    .from("track_metadata")
    .select("key, genre, year, energy_tier, energy_score, source")
    .in("key", keys);
  if (cacheErr) {
    return NextResponse.json({ error: errorMessage(cacheErr) }, { status: 500 });
  }

  const cachedMap = new Map((cached ?? []).map((row) => [row.key, row]));
  const results: Record<string, { genre: string | null; year: number | null; energyTier: string; energyScore: number }> = {};
  const toUpsert: {
    key: string;
    artist: string;
    title: string;
    genre: string | null;
    year: number | null;
    energy_tier: string;
    energy_score: number;
    source: string;
  }[] = [];

  let spotifyLookups = 0;
  const MAX_SPOTIFY_LOOKUPS_PER_REQUEST = 40; // keep each batch fast; client calls again for the rest

  for (const track of tracks) {
    const existing = cachedMap.get(track.key);
    if (existing) {
      results[track.key] = {
        genre: existing.genre,
        year: existing.year,
        energyTier: existing.energy_tier,
        energyScore: existing.energy_score,
      };
      continue;
    }

    let year = track.year;
    let source = "id3";
    if (!year && track.artist && track.title && spotifyLookups < MAX_SPOTIFY_LOOKUPS_PER_REQUEST) {
      spotifyLookups++;
      try {
        year = await lookupTrackYear(track.artist, track.title);
        if (year) source = "spotify";
      } catch {
        // leave year null on lookup failure — never fabricate
      }
    }

    const entry = {
      genre: track.genre,
      year,
      energyTier: track.energyTier,
      energyScore: track.energyScore,
    };
    results[track.key] = entry;
    toUpsert.push({
      key: track.key,
      artist: track.artist,
      title: track.title,
      genre: track.genre,
      year,
      energy_tier: track.energyTier,
      energy_score: track.energyScore,
      source,
    });
  }

  if (toUpsert.length > 0) {
    const { error: upsertErr } = await db.from("track_metadata").upsert(toUpsert, { onConflict: "key" });
    if (upsertErr) {
      // Non-fatal: enrichment results still return to the client even if caching failed
      console.error("track_metadata upsert failed:", upsertErr.message);
    }
  }

  return NextResponse.json({ results, remaining: tracks.length - Object.keys(results).length });
}
