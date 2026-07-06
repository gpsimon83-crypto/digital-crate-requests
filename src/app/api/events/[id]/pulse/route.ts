import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuth } from "@/lib/require-auth";
import { errorMessage } from "@/lib/error-message";

interface RequestRow {
  song_title: string;
  artist: string | null;
  genre: string | null;
  status: string;
  vote_count: number;
  boost_total_cents: number;
  created_at: string;
}

/** Computed on the fly from live requests/votes/boosts/tips — no separate snapshot table needed. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAuth();
  if (denied) return denied;
  const { id } = await params;
  try {
    const db = createAdminClient();
    const [{ data: requests, error: reqErr }, { data: tips, error: tipErr }] = await Promise.all([
      db
        .from("song_requests")
        .select("song_title, artist, genre, status, vote_count, boost_total_cents, created_at")
        .eq("event_id", id),
      db.from("tips").select("amount_cents").eq("event_id", id),
    ]);
    if (reqErr) throw reqErr;
    if (tipErr) throw tipErr;

    const activeRequests = ((requests as RequestRow[]) ?? []).filter((r) => r.status !== "declined");
    const totalVotes = activeRequests.reduce((sum, r) => sum + (r.vote_count ?? 0), 0);
    const totalBoostCents = activeRequests.reduce((sum, r) => sum + (r.boost_total_cents ?? 0), 0);
    const totalTipCents = (tips ?? []).reduce((sum, t) => sum + (t.amount_cents ?? 0), 0);

    const crowdEnergy = Math.max(
      0,
      Math.min(
        100,
        Math.round(
          activeRequests.length * 4 +
            totalVotes * 1.5 +
            (totalBoostCents / 100) * 2 +
            (totalTipCents / 100) * 1
        )
      )
    );

    const genreCounts = new Map<string, number>();
    for (const r of activeRequests) {
      const genre = r.genre || "Unknown";
      genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
    }
    const totalGenreVotes = [...genreCounts.values()].reduce((a, b) => a + b, 0) || 1;
    const topGenres = [...genreCounts.entries()]
      .map(([genre, count]) => ({ genre, pct: Math.round((count / totalGenreVotes) * 100) }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);

    const hotSongs = [...activeRequests]
      .sort((a, b) => b.vote_count + b.boost_total_cents / 100 - (a.vote_count + a.boost_total_cents / 100))
      .slice(0, 5)
      .map((r) => ({ songTitle: r.song_title, artist: r.artist, votes: r.vote_count }));

    const suggestedNext = activeRequests
      .filter((r) => r.status === "pending" || r.status === "approved")
      .sort((a, b) => b.vote_count - a.vote_count)
      .slice(0, 3)
      .map((r) => `${r.song_title}${r.artist ? ` — ${r.artist}` : ""}`);

    // Bucket request timestamps into 10 windows across the event so far, as an energy trend proxy.
    const now = Date.now();
    const earliest = activeRequests.length
      ? Math.min(...activeRequests.map((r) => new Date(r.created_at).getTime()))
      : now;
    const span = Math.max(now - earliest, 60_000);
    const bucketCount = 10;
    const history = new Array(bucketCount).fill(0);
    for (const r of activeRequests) {
      const t = new Date(r.created_at).getTime();
      const idx = Math.min(bucketCount - 1, Math.floor(((t - earliest) / span) * bucketCount));
      history[idx] += 1 + r.vote_count * 0.5;
    }

    return NextResponse.json({
      pulse: {
        crowdEnergy,
        history: history.map((v) => Math.round(v)),
        topGenres,
        hotSongs,
        suggestedNext,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
