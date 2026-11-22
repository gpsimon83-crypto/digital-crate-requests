import { createAdminClient } from "@/lib/supabase/admin";
import { getConnectionWithSecrets, updateAccessToken, updateSyncToken, updateScheduleSyncToken, recordSyncResult } from "@/lib/data/calendar-connection";
import { upsertBusyBlock, removeBusyBlock, clearAllBusyBlocks } from "@/lib/data/external-busy-blocks";
import { refreshAccessToken, upsertGoogleEvent, deleteGoogleEvent, listGoogleEvents, listGoogleCalendars, isOwnEvent } from "@/lib/google-calendar";

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

/** The calendars the connected Google account can see, for the Settings picker. Null when not connected. */
export async function listConnectedCalendars() {
  const auth = await getValidAccessToken();
  if (!auth) return null;
  return listGoogleCalendars(auth.accessToken);
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
      cratesdjEventId: event.id,
      // Inquiries and pending bookings are holds, not confirmed events.
      tentative: !["confirmed", "live", "ended"].includes(event.status)
    });

    if (googleEventId !== event.google_event_id) {
      await db.from("events").update({ google_event_id: googleEventId }).eq("id", event.id);
    }
    count += 1;
  }
  return count;
}

async function pullExternalEvents(accessToken: string, calendarId: string, syncToken: string | null): Promise<number> {
  // A full pull (no syncToken) replaces everything, so entries deleted on Google don't linger.
  // Forget the old token first: if this run fails part way, the next run starts a full pull again.
  if (!syncToken) {
    await updateSyncToken(null);
    await clearAllBusyBlocks();
  }
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

/**
 * The DJ schedule calendar (where the DJs write "Young Wedding - Penny"),
 * read into dj_schedule_entries. Read only: nothing is written to it, and
 * its entries don't block public booking slots.
 */
async function pullScheduleCalendar(accessToken: string, calendarId: string, syncToken: string | null): Promise<number> {
  const db = createAdminClient();
  const clear = async () => {
    await updateScheduleSyncToken(null);
    const { error } = await db.from("dj_schedule_entries").delete().neq("google_event_id", "");
    if (error) throw error;
  };
  if (!syncToken) await clear();
  let result = await listGoogleEvents(accessToken, calendarId, syncToken);
  if (result.needsFullResync) {
    await clear();
    result = await listGoogleEvents(accessToken, calendarId, null);
  }
  const gone: string[] = [];
  const rows: { google_event_id: string; summary: string | null; starts_at: string; ends_at: string; all_day: boolean; updated_at: string }[] = [];
  const now = new Date().toISOString();
  for (const e of result.events) {
    if (e.status === "cancelled") {
      gone.push(e.id);
      continue;
    }
    const start = e.start?.dateTime ?? e.start?.date;
    const end = e.end?.dateTime ?? e.end?.date;
    if (!start || !end) continue;
    const allDay = !e.start?.dateTime;
    // All-day dates are stored at midnight UTC so the date reads back unchanged.
    rows.push({ google_event_id: e.id, summary: e.summary ?? null, starts_at: allDay ? `${start}T00:00:00Z` : start, ends_at: allDay ? `${end}T00:00:00Z` : end, all_day: allDay, updated_at: now });
  }
  for (let i = 0; i < gone.length; i += 200) {
    const { error } = await db.from("dj_schedule_entries").delete().in("google_event_id", gone.slice(i, i + 200));
    if (error) throw error;
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await db.from("dj_schedule_entries").upsert(rows.slice(i, i + 200), { onConflict: "google_event_id" });
    if (error) throw error;
  }
  await updateScheduleSyncToken(result.nextSyncToken);
  return rows.length + gone.length;
}

interface SyncMeetingRow {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  meeting_url: string | null;
  notes: string | null;
  status: string;
  google_event_id: string | null;
  events: {
    title: string | null;
    clients: { first_name: string | null; last_name: string | null; company_name: string | null } | null;
  } | null;
}

const MEETING_SELECT =
  "id, event_id, starts_at, ends_at, location, meeting_url, notes, status, google_event_id, events(title, clients(first_name, last_name, company_name))";

async function pushOneMeeting(accessToken: string, calendarId: string, m: SyncMeetingRow): Promise<void> {
  const db = createAdminClient();

  if (m.status === "cancelled") {
    if (m.google_event_id) {
      await deleteGoogleEvent(accessToken, calendarId, m.google_event_id);
      await db.from("event_meetings").update({ google_event_id: null }).eq("id", m.id);
    }
    return;
  }

  const client = m.events?.clients;
  const clientName = client ? client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ") : null;
  const description = [clientName ? `Client: ${clientName}` : null, m.meeting_url ? `Join: ${m.meeting_url}` : null, m.notes].filter(Boolean).join("\n");

  const googleEventId = await upsertGoogleEvent(accessToken, calendarId, m.google_event_id, {
    summary: `Meeting — ${m.events?.title || "Digital Crate DJs"}`,
    description: description || undefined,
    location: m.location || m.meeting_url || undefined,
    startsAt: m.starts_at,
    endsAt: m.ends_at,
    cratesdjEventId: m.event_id
  });

  if (googleEventId !== m.google_event_id) {
    await db.from("event_meetings").update({ google_event_id: googleEventId }).eq("id", m.id);
  }
}

/**
 * Pushes one meeting to Google right when it's scheduled/changed/cancelled.
 * The batched sync isn't guaranteed to be running on a schedule, and a
 * client meeting shouldn't wait on it. Best-effort: never throws, so a
 * Google hiccup can't fail scheduling the meeting itself.
 */
export async function syncMeetingToGoogle(meetingId: string): Promise<void> {
  try {
    const auth = await getValidAccessToken();
    if (!auth) return; // Google Calendar isn't connected

    const db = createAdminClient();
    const { data, error } = await db.from("event_meetings").select(MEETING_SELECT).eq("id", meetingId).single();
    if (error) throw error;
    await pushOneMeeting(auth.accessToken, auth.calendarId, data as unknown as SyncMeetingRow);
  } catch (err) {
    console.error("Google Calendar sync failed for meeting", meetingId, err);
  }
}

async function pushMeetingsToGoogle(accessToken: string, calendarId: string): Promise<number> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("event_meetings")
    .select(MEETING_SELECT)
    .or(`status.eq.scheduled,google_event_id.not.is.null`)
    .gte("ends_at", new Date(Date.now() - PAST_CUTOFF_MS).toISOString());
  if (error) throw error;

  let count = 0;
  for (const m of data as unknown as SyncMeetingRow[]) {
    await pushOneMeeting(accessToken, calendarId, m);
    count += 1;
  }
  return count;
}

/**
 * One sync run. `full` re-reads the whole calendar (the past year onward)
 * instead of only the changes since last time: the "Pull the whole calendar
 * again" button in Settings.
 */
export async function runCalendarSync(opts: { full?: boolean } = {}): Promise<{ connected: boolean; pushed: number; pulled: number }> {
  const auth = await getValidAccessToken();
  if (!auth) return { connected: false, pushed: 0, pulled: 0 };

  try {
    const conn = await getConnectionWithSecrets();
    const pushed =
      (await pushEventsToGoogle(auth.accessToken, auth.calendarId)) + (await pushMeetingsToGoogle(auth.accessToken, auth.calendarId));
    let pulled = await pullExternalEvents(auth.accessToken, auth.calendarId, opts.full ? null : (conn?.syncToken ?? null));
    if (conn?.scheduleCalendarId) {
      pulled += await pullScheduleCalendar(auth.accessToken, conn.scheduleCalendarId, opts.full ? null : conn.scheduleSyncToken);
    }
    await recordSyncResult("ok");
    return { connected: true, pushed, pulled };
  } catch (err) {
    await recordSyncResult("error", err instanceof Error ? err.message : "Unknown error");
    throw err;
  }
}
