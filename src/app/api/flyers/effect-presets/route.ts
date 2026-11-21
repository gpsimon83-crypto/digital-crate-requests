import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { flyerActor, setupMissing, uuidOk } from "@/lib/flyers/server";
import { sanitizeEffects } from "@/lib/flyers/effects";

const MAX = 40;
const notReady = () => NextResponse.json({ error: "Saving presets needs migration 0062_flyer_effect_presets.sql.", setup: true }, { status: 503 });

/** Your saved Photo Effects presets. */
export async function GET() {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  const db = createAdminClient();
  const { data, error } = await db.from("flyer_effect_presets").select("id, name, effects, created_at").eq("user_id", actor.user.id).order("created_at", { ascending: false }).limit(MAX);
  if (error) return setupMissing(error) ? NextResponse.json({ presets: [], setup: true }) : NextResponse.json({ error: error.message }, { status: 503 });
  const presets = ((data ?? []) as { id: string; name: string; effects: unknown }[]).map((p) => ({ id: p.id, name: p.name, effects: sanitizeEffects(p.effects) })).filter((p) => p.effects);
  return NextResponse.json({ presets });
}

/** Save the current settings as a named preset (same name = replace). */
export async function POST(req: NextRequest) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  const b = (await req.json().catch(() => ({}))) as { name?: unknown; effects?: unknown };
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 40) : "";
  if (!name) return NextResponse.json({ error: "Name the preset." }, { status: 400 });
  const fx = sanitizeEffects(b.effects);
  if (!fx) return NextResponse.json({ error: "Pick an effect first." }, { status: 400 });
  const db = createAdminClient();
  const { count } = await db.from("flyer_effect_presets").select("id", { count: "exact", head: true }).eq("user_id", actor.user.id);
  const effects = { ...fx, custom: name };
  const { data: existing, error: e0 } = await db.from("flyer_effect_presets").select("id").eq("user_id", actor.user.id).eq("name", name).maybeSingle();
  if (e0 && setupMissing(e0)) return notReady();
  if (!existing && (count ?? 0) >= MAX) return NextResponse.json({ error: `You can keep up to ${MAX} presets. Delete one first.` }, { status: 400 });
  const { data, error } = existing
    ? await db.from("flyer_effect_presets").update({ effects }).eq("id", (existing as { id: string }).id).select("id, name, effects").single()
    : await db.from("flyer_effect_presets").insert({ user_id: actor.user.id, name, effects }).select("id, name, effects").single();
  if (error) return setupMissing(error) ? notReady() : NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ preset: data });
}

/** Delete one of your presets (flyers that used it keep their settings). */
export async function DELETE(req: NextRequest) {
  const actor = await flyerActor();
  if (actor instanceof NextResponse) return actor;
  const id = req.nextUrl.searchParams.get("id");
  if (!uuidOk(id)) return NextResponse.json({ error: "Which preset?" }, { status: 400 });
  const db = createAdminClient();
  const { error } = await db.from("flyer_effect_presets").delete().eq("id", id).eq("user_id", actor.user.id);
  if (error) return setupMissing(error) ? notReady() : NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ ok: true });
}
