import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  try {
    const db = createAdminClient();
    const { error } = await db.from("crate_templates").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Edit a template: name, description, event type, target genres/eras, clean-music rule, active. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const update: Record<string, unknown> = {};
  const text = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean).slice(0, 60) : []);
  if ("name" in b) {
    const n = text(b.name, 120);
    if (!n) return NextResponse.json({ error: "A template needs a name" }, { status: 400 });
    update.name = n;
  }
  if ("description" in b) update.description = text(b.description, 500);
  if ("eventType" in b) update.event_type = text(b.eventType, 80);
  if ("cleanRequirement" in b) update.clean_requirement = text(b.cleanRequirement, 80);
  if ("targetGenres" in b) update.target_genres = list(b.targetGenres);
  if ("targetEras" in b) update.target_eras = list(b.targetEras);
  if ("active" in b) update.active = !!b.active;
  if (Object.keys(update).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("crate_templates").update(update).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ template: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
