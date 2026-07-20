import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { requireAuth } from "@/lib/require-auth";

export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("crate_templates")
      .select("id, name, description, event_type, target_genres, target_eras, target_energy_distribution, clean_requirement, active")
      .order("name");
    if (error) throw error;
    return NextResponse.json({ templates: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { name, description, eventType, targetGenres, targetEras, cleanRequirement } = await req.json();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("crate_templates")
      .insert({
        name,
        description: description || null,
        event_type: eventType || null,
        target_genres: targetGenres ?? [],
        target_eras: targetEras ?? [],
        clean_requirement: cleanRequirement || null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ template: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
