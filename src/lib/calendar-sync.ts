import { createAdminClient } from "@/lib/supabase/admin";
import { getConnectionWithSecrets, updateAccessToken, updateSyncToken, recordSyncResult } from "@/lib/data/calendar-connection";
import { upsertBusyBlock, removeBusyBlock, clearAllBusyBlocks } from "@/lib/data/external-busy-blocks";
import { refreshAccessToken, upsertGoogleEvent, deleteGoogleEvent, listGoogleEvents, isOwnEvent } from "@/lib/google-calendar";

const DEFAULT_DURATION_MS = 6 * 60 * 60 * 1000;
// Events further in the past than this aren't worth pushing/updating on Google.
const PAST_CUTOFF_MS = 24 * 60 * 60 * 1000;

async function getValidAccessToken(): Promise<{ accessToken: string; calendarId: string } | null> {
  const conn = await getConnectionWithSecrets();
  if (!conn) return null;

  const expiresAt = new Date(conn.accessTokenExpiresAt).getTime();
  if (expiresAt - Date.now() > 2 * 60 * 1000) {
    return { accessToken: conn.accessToken, calendarId: conn.googleCalendarId };
  }

  const refreshed = await refreshAccessToken(conn.refreshToken);
  const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
  await updateAccessToken(refreshed.access_token, newExpiresAt);
  return { accessToken: refreshed.access_token, calendarId: conn.googleCalendarId };
}

interface SyncEventRow {
  id: string;
  title: string | null;
  event_type: string | null;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  google_event_id: string | null;
  venues: { name: string } | null;
  clients: { first_name: string | null; last_name: string | null; company_name: string | null } | null;
}

async function pushEventsToGoogle(accessToken: string, calendarId: string): Promise<number> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .select("id, title, event_type, starts_at, ends_at, status, google_event_id, venues(name), clients(first_name, last_name, company_name)")
    .not("starts_at", "is", null)
    .gte("starts_at", new Date(Date.now() - PAST_CUTOFF_MS).toISOString());
  if (error) throw error;

  let count = 0;
  for (const event of data as unknown as SyncEventRow[]) {
    if (event.status === "declined") {
      if (event.google_event_id) {
        await deleteGoogleEvent(accessToken, calendarId, event.google_event_id);
        await db.from("events").update({ google_event_id: null }).eq("id", event.id);
        count += 1;
      }
      continue;
    }

    const client = event.clients;
    const clientName = client ? client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ") : null;
    const startsAt = event.starts_at as string;
    const endsAt = event.ends_at ?? new Date(new Date(startsAt).getTime() + DEFAULT_DURATION_MS).toISOString();

    const googleEventId = await upsertGoogleEvent(accessToken, calendarId, event.google_event_id, {
      summary: event.title || "Digital Crate DJs booking",
      description: clientName ? `Client: ${clientName}` : undefined,
      location: event.venues?.name,
      startsAt,
      endsAt,
      cratesdjEventId: event.id
    });

    if (googleEventId !== event.google_event_id) {
      await db.from("events").update({ google_event_id: googleEventId }).eq("id", event.id);
    }
    count += 1;
  }
  return count;
}

async function pullExternalEvents(accessToken: string, calendarId: string, syncToken: string | null): Promise<number> {
  let result = await listGoogleEvents(accessToken, calendarId, syncToken);
  if (result.needsFullResync) {
    await clearAllBusyBlocks();
    result = await listGoogleEvents(accessToken, calendarId, null);
  }

  let count = 0;
  for (const event of result.events) {
    if (isOwnEvent(event)) continue; // don't pull our own pushed bookings back as "external"

    if (event.status === "cancelled") {
      await removeBusyBlock(event.id);
      count += 1;
      continue;
    }

    const start = event.start?.dateTime ?? event.start?.date;
    const end = event.end?.dateTime ?? event.end?.date;
    if (!start || !end) continue;

    await upsertBusyBlock({ googleEventId: event.id, summary: event.summary ?? null, startsAt: start, endsAt: end });
    count += 1;
  }

  await updateSyncToken(result.nextSyncToken);
  return count;
}

export async function runCalendarSync(): Promise<{ connected: boolean; pushed: number; pulled: number }> {
  const auth = await getValidAccessToken();
  if (!auth) return { connected: false, pushed: 0, pulled: 0 };

  try {
    const conn = await getConnectionWithSecrets();
    const pushed = await pushEventsToGoogle(auth.accessToken, auth.calendarId);
    const pulled = await pullExternalEvents(auth.accessToken, auth.calendarId, conn?.syncToken ?? null);
    await recordSyncResult("ok");
    return { connected: true, pushed, pulled };
  } catch (err) {
    await recordSyncResult("error", err instanceof Error ? err.message : "Unknown error");
    throw err;
  }
}
