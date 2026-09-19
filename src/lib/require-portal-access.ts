import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getClientForAuthUser, getClientEvent } from "@/lib/data/portal";
import { isStaffRole } from "@/lib/roles";

/**
 * Read-only access to a client-portal event's GET endpoints — the actual
 * linked client, same as always, OR staff previewing what a client sees
 * (e.g. after customizing the portal hero, or to help a client over the
 * phone). Staff never gets a write path through this: every POST/PATCH
 * portal route (pay, sign, submit questionnaire, acknowledge change
 * order, night-plan edits) still calls getClientForAuthUser directly and
 * is untouched by this helper, so a staff session can look but can't act
 * on the client's behalf.
 */
export async function requirePortalReadAccess(eventId: string) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { authorized: false as const, status: 401, error: "Not signed in" };

  if (isStaffRole(user.user_metadata?.role)) {
    const db = createAdminClient();
    const { data: event } = await db
      .from("events")
      .select("*, djs(display_name, photo_url, bio, hero_settings), venues(name), clients(*)")
      .eq("id", eventId)
      .maybeSingle();
    if (!event) return { authorized: false as const, status: 404, error: "Event not found" };
    return { authorized: true as const, event, isStaffPreview: true };
  }

  const client = await getClientForAuthUser(user.id);
  if (!client) return { authorized: false as const, status: 403, error: "No client record linked to this account" };

  const event = await getClientEvent(client.id, eventId);
  if (!event) return { authorized: false as const, status: 404, error: "Event not found" };

  return { authorized: true as const, event, isStaffPreview: false };
}
