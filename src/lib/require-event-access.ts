import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffRole } from "@/lib/roles";

/**
 * A project's email thread is visible to admin/staff (everyone) and to
 * whichever single DJ is assigned to that event (events.dj_id) — same
 * scoping already used for DJ Bookings, just enforced per-request here
 * since threads aren't behind /admin/* middleware.
 */
export async function requireEventAccess(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { authorized: false as const, status: 401, error: "Not signed in" };

  const isAdmin = isStaffRole(user.user_metadata?.role);

  const db = createAdminClient();
  const { data: dj } = await db.from("djs").select("id, display_name").eq("auth_user_id", user.id).maybeSingle();

  if (!isAdmin && !dj) return { authorized: false as const, status: 403, error: "No access to this project" };

  const { data: event } = await db.from("events").select("id, dj_id, client_id, title, event_code, clients(email, first_name, last_name)").eq("id", eventId).maybeSingle();
  if (!event) return { authorized: false as const, status: 404, error: "Project not found" };

  if (!isAdmin && event.dj_id !== dj?.id) {
    return { authorized: false as const, status: 403, error: "No access to this project" };
  }

  return { authorized: true as const, user, isAdmin, dj, event };
}
