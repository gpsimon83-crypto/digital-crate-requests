import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

/** Reorder the category tabs: { ids: [first, second, …] }. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as { ids?: unknown };
  const ids = Array.isArray(b.ids) ? b.ids.filter((x): x is string => typeof x === "string").slice(0, 100) : [];
  if (!ids.length) return NextResponse.json({ error: "Nothing to reorder" }, { status: 400 });
  try {
    const db = createAdminClient();
    for (const [i, id] of ids.entries()) {
      const { error } = await db.from("service_categories").update({ position: i }).eq("id", id);
      if (error) throw error;
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
