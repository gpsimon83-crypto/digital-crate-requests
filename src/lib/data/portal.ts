import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Links the authenticated user to their existing `clients` row, matched by
 * the AUTHENTICATED session's verified email (never anything user-
 * submitted) — the same trust boundary Supabase Auth's own email
 * verification already provides, so a client record can only be claimed
 * by someone who actually owns that inbox.
 *
 * Idempotent: already-linked-to-this-user is a no-op success. Linked to a
 * different user is left alone (returns null, caller shows a generic
 * "contact us" state rather than exposing that the email is taken).
 */
export async function linkClientToAuthUser(userId: string, email: string) {
  const db = createAdminClient();

  const { data: existing } = await db.from("clients").select("id, auth_user_id").eq("auth_user_id", userId).maybeSingle();
  if (existing) return existing.id;

  const { data: match } = await db
    .from("clients")
    .select("id, auth_user_id")
    .eq("email", email)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!match || match.auth_user_id) return null;

  const { data: updated, error } = await db
    .from("clients")
    .update({ auth_user_id: userId })
    .eq("id", match.id)
    .select("id")
    .single();
  if (error) throw error;
  return updated.id;
}

export async function getClientForAuthUser(userId: string) {
  const db = createAdminClient();
  const { data, error } = await db.from("clients").select("*").eq("auth_user_id", userId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function listClientEvents(clientId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .select("*, djs(display_name, photo_url), venues(name)")
    .eq("client_id", clientId)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function getClientEvent(clientId: string, eventId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .select("*, djs(display_name, photo_url), venues(name)")
    .eq("id", eventId)
    .eq("client_id", clientId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateClientEventNight(
  clientId: string,
  eventId: string,
  updates: { must_play?: unknown; do_not_play?: unknown; special_requests?: string }
) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .update(updates)
    .eq("id", eventId)
    .eq("client_id", clientId) // ownership check baked into the write itself
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
