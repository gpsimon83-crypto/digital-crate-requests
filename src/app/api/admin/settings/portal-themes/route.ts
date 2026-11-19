import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/require-admin";
import { EVENT_CATEGORY_LABELS } from "@/lib/event-category";
import { isPortalTheme } from "@/lib/portal-themes";

/** Staff: the client-portal palette assigned to each event category. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { data, error } = await createAdminClient().from("platform_settings").select("portal_theme_by_category").eq("id", true).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ ready: true, byCategory: (data?.portal_theme_by_category as Record<string, string> | null) ?? {} });
  } catch {
    // Before migration 0057 the column doesn't exist: built-in defaults apply.
    return NextResponse.json({ ready: false, byCategory: {} });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = (await req.json().catch(() => ({}))) as { byCategory?: Record<string, unknown> };
  const byCategory: Record<string, string> = {};
  for (const [k, v] of Object.entries(body.byCategory ?? {})) if (k in EVENT_CATEGORY_LABELS && isPortalTheme(v)) byCategory[k] = v;
  try {
    const { error } = await createAdminClient().from("platform_settings").update({ portal_theme_by_category: byCategory }).eq("id", true);
    if (error) throw error;
    return NextResponse.json({ ready: true, byCategory });
  } catch {
    return NextResponse.json({ error: "Run migration 0057_portal_themes.sql in Supabase first." }, { status: 503 });
  }
}
