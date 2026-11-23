import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { setLinks } from "@/lib/data/catalog";
import { parseAddonInput } from "@/lib/data/catalog-addons";
import { errorMessage } from "@/lib/error-message";

/** Edit an add-on: name, description, price, active, categories it's offered in, packages that include it. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const parsed = parseAddonInput((await req.json().catch(() => ({}))) as Record<string, unknown>, false);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const db = createAdminClient();
    if (Object.keys(parsed.row).length) {
      const { error } = await db.from("package_addons").update({ ...parsed.row, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    }
    if (parsed.categoryIds) await setLinks(db, "addon_category_links", "addon_id", id, "category_id", parsed.categoryIds);
    if (parsed.packageIds) {
      const del = await db.from("package_included_addons").delete().eq("addon_id", id);
      if (del.error) throw del.error;
      if (parsed.packageIds.length) {
        const ins = await db.from("package_included_addons").insert(parsed.packageIds.map((p) => ({ package_id: p, addon_id: id })));
        if (ins.error) throw ins.error;
      }
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
