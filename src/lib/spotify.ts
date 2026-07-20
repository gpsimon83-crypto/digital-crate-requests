let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const basic = Buffer.from(`${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!res.ok) throw new Error(`Spotify auth failed: ${res.status}`);
  const data = await res.json();
  cachedToken = { value: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedToken.value;
}

export async function searchTracks(query: string, limit = 8) {
  const token = await getAccessToken();
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", query);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`Spotify search failed: ${res.status}`);
  const data = await res.json();

  return (data.tracks?.items ?? []).map((t: SpotifyTrack) => ({
    id: t.id,
    title: t.name,
    artist: t.artists.map((a) => a.name).join(", "),
    albumArt: t.album?.images?.[2]?.url ?? t.album?.images?.[0]?.url ?? null,
    explicit: t.explicit,
    durationMs: t.duration_ms,
  }));
}

interface SpotifyTrack {
  id: string;
  name: string;
  artists: { name: string }[];
  album?: { images?: { url: string }[] };
  explicit: boolean;
  duration_ms: number;
}

/**
 * Looks up a track's release year via Spotify search. This is the only
 * enrichment field Spotify can still reliably provide for this app —
 * genre (via track or artist objects) and audio-features (energy, BPM)
 * both return stripped/403 responses at this app's access tier, verified
 * directly against the live API rather than assumed.
 */
export async function lookupTrackYear(artist: string, title: string): Promise<number | null> {
  const token = await getAccessToken();
  const url = new URL("https://api.spotify.com/v1/search");
  url.searchParams.set("q", `track:${title} artist:${artist}`);
  url.searchParams.set("type", "track");
  url.searchParams.set("limit", "1");

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return null;
  const data = await res.json();
  const releaseDate: string | undefined = data.tracks?.items?.[0]?.album?.release_date;
  if (!releaseDate) return null;
  const year = parseInt(releaseDate.slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}
