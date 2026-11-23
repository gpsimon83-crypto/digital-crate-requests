import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "category";

/** Add an event category (shown last). */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { name?: unknown };
  const name = typeof b.name === "string" ? b.name.trim().slice(0, 60) : "";
  if (!name) return NextResponse.json({ error: "Give the category a name." }, { status: 400 });
  try {
    const db = createAdminClient();
    const { data: last } = await db.from("service_categories").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    let slug = slugify(name);
    const { data: taken } = await db.from("service_categories").select("slug").like("slug", `${slug}%`);
    const used = new Set(((taken ?? []) as { slug: string }[]).map((t) => t.slug));
    for (let i = 2; used.has(slug); i++) slug = `${slugify(name).slice(0, 55)}-${i}`;
    const { data, error } = await db.from("service_categories").insert({ name, slug, position: ((last as { position: number } | null)?.position ?? -1) + 1 }).select().single();
    if (error) throw error;
    return NextResponse.json({ category: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
