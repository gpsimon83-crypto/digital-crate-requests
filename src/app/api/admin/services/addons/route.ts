import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { setLinks } from "@/lib/data/catalog";
import { parseAddonInput } from "@/lib/data/catalog-addons";
import { errorMessage } from "@/lib/error-message";

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const parsed = parseAddonInput((await req.json().catch(() => ({}))) as Record<string, unknown>, true);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const db = createAdminClient();
    const { data: last } = await db.from("package_addons").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await db.from("package_addons").insert({ ...parsed.row, position: ((last as { position: number } | null)?.position ?? -1) + 1 }).select("id").single();
    if (error) throw error;
    const id = (data as { id: string }).id;
    if (parsed.categoryIds) await setLinks(db, "addon_category_links", "addon_id", id, "category_id", parsed.categoryIds);
    if (parsed.packageIds) for (const p of parsed.packageIds) await db.from("package_included_addons").upsert({ package_id: p, addon_id: id });
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
