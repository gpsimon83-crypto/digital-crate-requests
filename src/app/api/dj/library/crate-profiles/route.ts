import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

const STAFF_ROLES = ["owner", "admin", "manager"];

async function currentDj(userId: string) {
  const db = createAdminClient();
  const { data } = await db.from("djs").select("id, display_name").eq("auth_user_id", userId).maybeSingle();
  return data;
}

/**
 * Crate profiles are a "shadow" record over a DJ's real local .crate file
 * (matched by dj + crate name) — guided-setup answers, organization
 * category, and Elite status/sharing. The actual track list always lives
 * on the DJ's own drive; song_keys here is only a snapshot used for
 * cross-DJ Elite Pack matching, never the source of truth.
 */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const scope = req.nextUrl.searchParams.get("scope");
  const db = createAdminClient();

  if (scope === "shared-elite") {
    const { data, error } = await db
      .from("crate_profiles")
      .select("id, dj_id, name, category, elite_category, song_keys, updated_at, djs(display_name)")
      .eq("is_elite", true)
      .eq("is_shared", true)
      .order("updated_at", { ascending: false });
    if (error) return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
    return NextResponse.json({ profiles: data ?? [] });
  }

  const dj = await currentDj(user.id);
  if (!dj) return NextResponse.json({ profiles: [] });

  const namesParam = req.nextUrl.searchParams.get("names") ?? "";
  const names = namesParam.split(",").map((n) => n.trim()).filter(Boolean);
  let query = db.from("crate_profiles").select("*").eq("dj_id", dj.id);
  if (names.length > 0) query = query.in("name", names);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: errorMessage(error) }, { status: 500 });
  return NextResponse.json({ profiles: data ?? [] });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const body = (await req.json()) as {
    name: string;
    category?: string | null;
    subcategory?: string | null;
    isElite?: boolean;
    eliteCategory?: string | null;
    isShared?: boolean;
    guidedSetup?: Record<string, unknown> | null;
    songKeys?: { key: string; artist: string; title: string }[];
    energySections?: { key: string; section: string }[];
    dismissedKeys?: string[];
    /** Only present when a staff member is editing another DJ's crate. */
    targetDjId?: string;
  };

  if (!body.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const isStaff = STAFF_ROLES.includes((user.user_metadata?.role as string | undefined) ?? "");
  const dj = await currentDj(user.id);

  let djId = dj?.id;
  if (body.targetDjId && body.targetDjId !== dj?.id) {
    if (!isStaff) {
      return NextResponse.json({ error: "Only staff can edit another DJ's crate." }, { status: 403 });
    }
    djId = body.targetDjId;
  }

  // Elite/shared status changes on a crate you don't own require staff.
  const changesEliteFields = body.isElite !== undefined || body.eliteCategory !== undefined || body.isShared !== undefined;
  if (changesEliteFields && djId !== dj?.id && !isStaff) {
    return NextResponse.json({ error: "Admin access required to change Elite status on another DJ's crate." }, { status: 403 });
  }

  if (!djId) {
    return NextResponse.json({ error: "No DJ profile linked to this account yet." }, { status: 400 });
  }

  const db = createAdminClient();

  // Merge over the existing row rather than blind-upserting defaults, so a
  // routine re-save (e.g. adding one song) never silently resets fields the
  // caller didn't intend to touch — Elite status/category especially.
  const { data: existing } = await db
    .from("crate_profiles")
    .select("*")
    .eq("dj_id", djId)
    .eq("name", body.name)
    .maybeSingle();

  const row = {
    dj_id: djId,
    name: body.name,
    category: body.category !== undefined ? body.category : existing?.category ?? null,
    subcategory: body.subcategory !== undefined ? body.subcategory : existing?.subcategory ?? null,
    is_elite: body.isElite !== undefined ? body.isElite : existing?.is_elite ?? false,
    elite_category: body.eliteCategory !== undefined ? body.eliteCategory : existing?.elite_category ?? null,
    elite_source: changesEliteFields
      ? (isStaff && djId !== dj?.id ? "admin_curated" : "dj_curated")
      : existing?.elite_source ?? "dj_curated",
    is_shared: body.isShared !== undefined ? body.isShared : existing?.is_shared ?? false,
    guided_setup: body.guidedSetup !== undefined ? body.guidedSetup : existing?.guided_setup ?? null,
    song_keys: body.songKeys !== undefined ? body.songKeys : existing?.song_keys ?? [],
    energy_sections: body.energySections !== undefined ? body.energySections : existing?.energy_sections ?? [],
    dismissed_keys: body.dismissedKeys !== undefined ? body.dismissedKeys : existing?.dismissed_keys ?? [],
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await db
    .from("crate_profiles")
    .upsert(row, { onConflict: "dj_id,name" })
    .select()
    .single();
  if (error) return NextResponse.json({ error: errorMessage(error) }, { status: 500 });

  return NextResponse.json({ profile: data });
}
