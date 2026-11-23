import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

/** Rename a category, or turn it off/on (its packages stay; it just stops showing). */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as { name?: unknown; isActive?: unknown };
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if ("name" in b) {
    const name = typeof b.name === "string" ? b.name.trim().slice(0, 60) : "";
    if (!name) return NextResponse.json({ error: "Give the category a name." }, { status: 400 });
    update.name = name;
  }
  if ("isActive" in b) update.is_active = !!b.isActive;
  if (Object.keys(update).length === 1) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  try {
    const { data, error } = await createAdminClient().from("service_categories").update(update).eq("id", id).select().single();
    if (error) throw error;
    return NextResponse.json({ category: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
