import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

/** Reorder the packages in one category: { categoryId, packageIds: [first, …] }. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { categoryId?: unknown; packageIds?: unknown };
  const ids = Array.isArray(b.packageIds) ? b.packageIds.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
  if (typeof b.categoryId !== "string" || !ids.length) return NextResponse.json({ error: "Nothing to reorder" }, { status: 400 });
  try {
    const db = createAdminClient();
    for (const [i, id] of ids.entries()) {
      const { error } = await db.from("package_category_links").update({ position: i }).eq("category_id", b.categoryId).eq("package_id", id);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
