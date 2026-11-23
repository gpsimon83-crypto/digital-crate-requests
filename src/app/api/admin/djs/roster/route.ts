import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { portalAccess, type AuthUserLike } from "@/lib/dj/portal-access";

/**
 * The Manage DJs roster: every DJ with their portal-access state, worked out
 * from their linked login (Supabase Auth) and any setup link waiting. Staff
 * only, and read only: it never changes a DJ or an account.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const db = createAdminClient();
    const { data: djs, error } = await db.from("djs").select("id, display_name, auth_user_id, photo_url, hero_settings").order("display_name");
    if (error) throw error;

    // Logins, a page at a time (only the fields that decide access are used).
    const users = new Map<string, AuthUserLike>();
    for (let page = 1; page <= 20; page++) {
      const { data, error: e } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (e) throw e;
      for (const u of data.users) users.set(u.id, { id: u.id, invited_at: u.invited_at, email_confirmed_at: u.email_confirmed_at, confirmed_at: u.confirmed_at, last_sign_in_at: u.last_sign_in_at, banned_until: (u as { banned_until?: string | null }).banned_until ?? null });
      if (data.users.length < 1000) break;
    }

    // Unused setup links assigned to a DJ (table may predate assignment: tolerate errors).
    const { data: codes } = await db.from("invite_codes").select("assigned_dj_id").eq("used", false).not("assigned_dj_id", "is", null);
    const withCode = new Set(((codes ?? []) as { assigned_dj_id: string | null }[]).map((c) => c.assigned_dj_id).filter(Boolean) as string[]);

    const roster = (djs ?? []).map((d) => {
      const u = d.auth_user_id ? users.get(d.auth_user_id) : null;
      return { ...d, access: portalAccess(d, u, withCode.has(d.id)), last_sign_in_at: u?.last_sign_in_at ?? null };
    });
    return NextResponse.json({ djs: roster });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
