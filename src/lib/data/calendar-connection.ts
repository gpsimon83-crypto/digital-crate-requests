import { createAdminClient } from "@/lib/supabase/admin";
import { encryptSecret, decryptSecret } from "@/lib/email-crypto";

export interface CalendarConnectionPublic {
  googleCalendarId: string;
  connectedEmail: string | null;
  connectedAt: string;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
}

export interface CalendarConnectionInternal extends CalendarConnectionPublic {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  syncToken: string | null;
}

function toPublic(row: {
  google_calendar_id: string;
  connected_email: string | null;
  connected_at: string;
  last_synced_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
}): CalendarConnectionPublic {
  return {
    googleCalendarId: row.google_calendar_id,
    connectedEmail: row.connected_email,
    connectedAt: row.connected_at,
    lastSyncedAt: row.last_synced_at,
    lastSyncStatus: row.last_sync_status,
    lastSyncError: row.last_sync_error
  };
}

export async function getConnection(): Promise<CalendarConnectionPublic | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("calendar_connection").select("*").eq("id", true).maybeSingle();
  if (error) throw error;
  return data ? toPublic(data) : null;
}

/** Includes decrypted tokens — only for the sync engine, never returned from an API route. */
export async function getConnectionWithSecrets(): Promise<CalendarConnectionInternal | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("calendar_connection").select("*").eq("id", true).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    ...toPublic(data),
    accessToken: decryptSecret(data.encrypted_access_token),
    refreshToken: decryptSecret(data.encrypted_refresh_token),
    accessTokenExpiresAt: data.access_token_expires_at,
    syncToken: data.sync_token
  };
}

export async function saveConnection(input: {
  googleCalendarId?: string;
  connectedEmail: string | null;
  accessToken: string;
  refreshToken?: string;
  expiresAt: string;
  connectedBy: string;
}) {
  const db = createAdminClient();

  // Google only returns a refresh_token on the very first consent (or when
  // prompt=consent forces re-issue) — if this exchange didn't include one,
  // keep whatever was already stored instead of overwriting with nothing.
  const existing = input.refreshToken ? null : await db.from("calendar_connection").select("encrypted_refresh_token").eq("id", true).maybeSingle();
  const encryptedRefreshToken = input.refreshToken ? encryptSecret(input.refreshToken) : existing?.data?.encrypted_refresh_token;
  if (!encryptedRefreshToken) throw new Error("No refresh token available — Google didn't issue one and none is stored yet");

  const { error } = await db.from("calendar_connection").upsert(
    {
      id: true,
      google_calendar_id: input.googleCalendarId ?? "primary",
      connected_email: input.connectedEmail,
      encrypted_access_token: encryptSecret(input.accessToken),
      encrypted_refresh_token: encryptedRefreshToken,
      access_token_expires_at: input.expiresAt,
      connected_by: input.connectedBy,
      connected_at: new Date().toISOString(),
      sync_token: null,
      last_synced_at: null,
      last_sync_status: null,
      last_sync_error: null
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}

export async function updateAccessToken(accessToken: string, expiresAt: string) {
  const db = createAdminClient();
  const { error } = await db
    .from("calendar_connection")
    .update({ encrypted_access_token: encryptSecret(accessToken), access_token_expires_at: expiresAt })
    .eq("id", true);
  if (error) throw error;
}

export async function updateSyncToken(syncToken: string | null) {
  const db = createAdminClient();
  const { error } = await db.from("calendar_connection").update({ sync_token: syncToken }).eq("id", true);
  if (error) throw error;
}

export async function recordSyncResult(status: "ok" | "error", errorMessage?: string) {
  const db = createAdminClient();
  const { error } = await db
    .from("calendar_connection")
    .update({ last_synced_at: new Date().toISOString(), last_sync_status: status, last_sync_error: errorMessage ?? null })
    .eq("id", true);
  if (error) throw error;
}

export async function deleteConnection() {
  const db = createAdminClient();
  const { error } = await db.from("calendar_connection").delete().eq("id", true);
  if (error) throw error;
}
