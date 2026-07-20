import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

const VALID_TAG_TYPES = new Set([
  "genre", "era", "song_function", "crowd_fit", "vocal_type", "content_rating", "crate_status",
]);

/** Batch-fetches every tag for the given track keys, grouped by type. */
export async function GET(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const keysParam = req.nextUrl.searchParams.get("keys") ?? "";
  const keys = keysParam.split(",").map((k) => k.trim()).filter(Boolean);
  if (keys.length === 0) {
    return NextResponse.json({ tags: {} });
  }

  const db = createAdminClient();
  const { data, error } = await db
    .from("track_tags")
    .select("track_key, tag_type, tag_value")
    .in("track_key", keys);
  if (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  }

  const tags: Record<string, Record<string, string[]>> = {};
  for (const row of data ?? []) {
    tags[row.track_key] ??= {};
    tags[row.track_key][row.tag_type] ??= [];
    tags[row.track_key][row.tag_type].push(row.tag_value);
  }

  return NextResponse.json({ tags });
}

/** Replaces all tags of one type for one track — works for both
 * single-select types (content_rating, crate_status, era, vocal_type,
 * passing a one-item array) and multi-select types (genre, song_function,
 * crowd_fit) since both are just "the new full set of values". */
export async function POST(req: NextRequest) {
  const denied = await requireAuth();
  if (denied) return denied;

  const { trackKey, tagType, values } = (await req.json()) as {
    trackKey: string;
    tagType: string;
    values: string[];
  };

  if (!trackKey || !VALID_TAG_TYPES.has(tagType) || !Array.isArray(values)) {
    return NextResponse.json({ error: "trackKey, a valid tagType, and a values array are required" }, { status: 400 });
  }

  const db = createAdminClient();
  const { error: deleteErr } = await db
    .from("track_tags")
    .delete()
    .eq("track_key", trackKey)
    .eq("tag_type", tagType);
  if (deleteErr) {
    return NextResponse.json({ error: errorMessage(deleteErr) }, { status: 500 });
  }

  const cleanValues = [...new Set(values.map((v) => v.trim()).filter(Boolean))];
  if (cleanValues.length > 0) {
    const { error: insertErr } = await db
      .from("track_tags")
      .insert(cleanValues.map((tag_value) => ({ track_key: trackKey, tag_type: tagType, tag_value })));
    if (insertErr) {
      return NextResponse.json({ error: errorMessage(insertErr) }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
