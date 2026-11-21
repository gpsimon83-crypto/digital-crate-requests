import { cookies } from "next/headers";
import type { createAdminClient } from "@/lib/supabase/admin";
import { accountRole, isStaffRole } from "@/lib/roles";

type Db = ReturnType<typeof createAdminClient>;

/**
 * "View as DJ": staff can look at the DJ dashboard exactly as one DJ sees
 * it, read-only. The choice is a cookie holding that DJ's id; it's only
 * honored for a staff login (checked against the account itself, never the
 * cookie), and while it's set the middleware refuses every change
 * (POST/PUT/PATCH/DELETE) and drops the cookie as soon as an /admin page
 * is opened. Shared by every place that works out "which DJ is this?".
 */
export const VIEW_AS_COOKIE = "dcdj_view_as";
/** Readable by the page (name only) so the banner can show without a request. */
export const VIEW_AS_NAME_COOKIE = "dcdj_view_as_name";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The DJ id being viewed, when the signed-in account is staff and View as DJ is on. */
export async function viewAsDjId(db: Db, user: { id: string; app_metadata?: Record<string, unknown> | null }): Promise<string | null> {
  let v: string | undefined;
  try {
    v = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  } catch {
    return null; // not in a request
  }
  if (!v || !UUID.test(v)) return null;
  if (isStaffRole(accountRole(user))) return v;
  // The session's copy of the user may be stale: confirm the role on the account itself.
  const { data } = await db.auth.admin.getUserById(user.id).catch(() => ({ data: null }));
  return isStaffRole(accountRole(data?.user ?? null)) ? v : null;
}

/** Same, when only the user id is at hand (looks the account up only if the cookie is there). */
export async function viewAsDjIdFor(db: Db, userId: string): Promise<string | null> {
  let v: string | undefined;
  try {
    v = (await cookies()).get(VIEW_AS_COOKIE)?.value;
  } catch {
    return null;
  }
  if (!v || !UUID.test(v)) return null;
  const { data } = await db.auth.admin.getUserById(userId).catch(() => ({ data: null }));
  return isStaffRole(accountRole(data?.user ?? null)) ? v : null;
}

/**
 * The DJ profile this login acts as: the viewed DJ in View as DJ, otherwise
 * the profile linked to the login. `select` is the columns wanted.
 */
export async function djRowForUser<T = { id: string }>(db: Db, userId: string, select = "id"): Promise<T | null> {
  const viewing = await viewAsDjIdFor(db, userId);
  const q = db.from("djs").select(select);
  const { data } = viewing ? await q.eq("id", viewing).maybeSingle() : await q.eq("auth_user_id", userId).maybeSingle();
  return (data as T | null) ?? null;
}
