import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

async function currentDjId(userId: string): Promise<string | null> {
  const db = createAdminClient();
  const { data } = await db.from("djs").select("id").eq("auth_user_id", userId).maybeSingle();
  return data?.id ?? null;
}

/**
 * Per-DJ private song ratings/performance notes (1-5 stars, crowd reaction
 * 1-10, feedback tags, freeform notes). Not shared across DJs yet —
 * visibility controls are a later phase.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const djId = await currentDjId(user.id);
  if (!djId) return NextResponse.json({ ratings: {} });

  const keysParam = req.nextUrl.searchParams.get("keys");
  const db = createAdminClient();
  let query = db.from("song_ratings").select("track_key, stars, crowd_reaction, feedback_tags, notes").eq("dj_id", djId);
  if (keysParam) {
    const keys = keysParam.split(",").map((k) => k.trim()).filter(Boolean);
    query = query.in("track_key", keys);
  }

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: errorMessage(error) }, { status: 500 });

  const ratings: Record<string, { stars: number | null; crowdReaction: number | null; feedbackTags: string[]; notes: string | null }> = {};
  for (const row of data ?? []) {
    ratings[row.track_key] = {
      stars: row.stars, crowdReaction: row.crowd_reaction,
      feedbackTags: row.feedback_tags ?? [], notes: row.notes,
    };
  }
  return NextResponse.json({ ratings });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const djId = await currentDjId(user.id);
  if (!djId) return NextResponse.json({ error: "No DJ profile linked to this account yet." }, { status: 400 });

  const { trackKey, stars, crowdReaction, feedbackTags, notes } = (await req.json()) as {
    trackKey: string;
    stars?: number | null;
    crowdReaction?: number | null;
    feedbackTags?: string[];
    notes?: string | null;
  };
  if (!trackKey) return NextResponse.json({ error: "trackKey is required" }, { status: 400 });

  const db = createAdminClient();
  const { data, error } = await db
    .from("song_ratings")
    .upsert(
      {
        dj_id: djId,
        track_key: trackKey,
        stars: stars ?? null,
        crowd_reaction: crowdReaction ?? null,
        feedback_tags: feedbackTags ?? [],
        notes: notes ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "dj_id,track_key" }
    )
    .select()
    .single();
  if (error) return NextResponse.json({ error: errorMessage(error) }, { status: 500 });

  return NextResponse.json({ rating: data });
}
