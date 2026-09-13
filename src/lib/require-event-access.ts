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
  const { data: dj } = await db
    .from("djs")
    .select("id, display_name, signature_phone, signature_email")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (!isAdmin && !dj) return { authorized: false as const, status: 403, error: "No access to this project" };

  const { data: event } = await db.from("events").select("id, dj_id, client_id, title, event_code, clients(email, first_name, last_name)").eq("id", eventId).maybeSingle();
  if (!event) return { authorized: false as const, status: 404, error: "Project not found" };

  if (!isAdmin && event.dj_id !== dj?.id) {
    return { authorized: false as const, status: 403, error: "No access to this project" };
  }

  return { authorized: true as const, user, isAdmin, dj, event };
}

/**
 * Same ownership check as requireEventAccess, but for an action keyed by a
 * song_requests.id rather than an events.id directly (approve/decline/
 * mark-played) — resolves the request's event first, then delegates.
 */
export async function requireRequestEventAccess(requestId: string) {
  const db = createAdminClient();
  const { data: request } = await db.from("song_requests").select("event_id").eq("id", requestId).maybeSingle();
  if (!request) return { authorized: false as const, status: 404, error: "Request not found" };
  return requireEventAccess(request.event_id);
}
