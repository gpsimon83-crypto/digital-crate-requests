// Direct REST calls to Google's OAuth2 + Calendar v3 endpoints, matching
// this codebase's existing fetch-based integration style (see spotify.ts)
// rather than pulling in the full googleapis SDK for a handful of calls.

const OAUTH_BASE = "https://oauth2.googleapis.com";
const CALENDAR_BASE = "https://www.googleapis.com/calendar/v3";
const SCOPE = "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.email";

function redirectUri() {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/admin/calendar/oauth/callback`;
}

export function buildAuthUrl(state: string) {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
}

export async function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: redirectUri(),
      grant_type: "authorization_code"
    })
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await fetch(`${OAUTH_BASE}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token"
    })
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function revokeToken(token: string): Promise<void> {
  await fetch(`${OAUTH_BASE}/revoke?token=${encodeURIComponent(token)}`, { method: "POST" }).catch(() => {
    // best-effort — a failed revoke shouldn't block disconnecting locally
  });
}

export async function fetchConnectedEmail(accessToken: string): Promise<string | null> {
  const res = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email ?? null;
}

export interface GoogleEventPayload {
  summary: string;
  description?: string;
  location?: string;
  startsAt: string;
  endsAt: string;
  cratesdjEventId: string;
  /** Not yet a confirmed booking: shown as a tentative hold on Google Calendar. */
  tentative?: boolean;
}

const SOURCE_TAG = "cratesdj";

export async function upsertGoogleEvent(
  accessToken: string,
  calendarId: string,
  existingGoogleEventId: string | null,
  payload: GoogleEventPayload
): Promise<string> {
  const body = {
    status: payload.tentative ? "tentative" : "confirmed",
    summary: payload.tentative ? `Tentative hold: ${payload.summary}` : payload.summary,
    description: payload.description,
    location: payload.location,
    start: { dateTime: payload.startsAt },
    end: { dateTime: payload.endsAt },
    extendedProperties: { private: { source: SOURCE_TAG, cratesdjEventId: payload.cratesdjEventId } }
  };

  const url = existingGoogleEventId
    ? `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${existingGoogleEventId}`
    : `${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;

  const res = await fetch(url, {
    method: existingGoogleEventId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });

  // The event may have been deleted on Google's side out-of-band — fall
  // back to creating a new one instead of failing the whole sync.
  if (existingGoogleEventId && (res.status === 404 || res.status === 410)) {
    return upsertGoogleEvent(accessToken, calendarId, null, payload);
  }
  if (!res.ok) throw new Error(`Google Calendar upsert failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.id;
}

export async function deleteGoogleEvent(accessToken: string, calendarId: string, googleEventId: string): Promise<void> {
  const res = await fetch(`${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok && res.status !== 404 && res.status !== 410 && res.status !== 204) {
    throw new Error(`Google Calendar delete failed: ${res.status} ${await res.text()}`);
  }
}

export interface GoogleEventListResult {
  events: {
    id: string;
    status: string;
    summary?: string;
    start?: { dateTime?: string; date?: string };
    end?: { dateTime?: string; date?: string };
    extendedProperties?: { private?: Record<string, string> };
  }[];
  nextSyncToken: string | null;
  /** true when Google rejected the syncToken (410) and a full resync is required. */
  needsFullResync: boolean;
}

/** How far back a full pull reaches, so DJs can look back at past months on their calendar. */
export const FULL_SYNC_HISTORY_DAYS = 365;

/**
 * Incremental pull via Google's syncToken when we have one; otherwise a full
 * sync from a year ago onward (the booking-slot checks only look at future
 * entries; the past year is for the DJ portal calendar). Paginates until
 * nextSyncToken appears.
 */
export async function listGoogleEvents(accessToken: string, calendarId: string, syncToken: string | null): Promise<GoogleEventListResult> {
  const events: GoogleEventListResult["events"] = [];
  let pageToken: string | undefined;
  let nextSyncToken: string | null = null;

  for (;;) {
    const url = new URL(`${CALENDAR_BASE}/calendars/${encodeURIComponent(calendarId)}/events`);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("maxResults", "250");
    if (syncToken) {
      url.searchParams.set("syncToken", syncToken);
    } else {
      url.searchParams.set("timeMin", new Date(Date.now() - FULL_SYNC_HISTORY_DAYS * 86400000).toISOString());
    }
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (res.status === 410) {
      return { events: [], nextSyncToken: null, needsFullResync: true };
    }
    if (!res.ok) throw new Error(`Google Calendar list failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    events.push(...(data.items ?? []));
    if (data.nextPageToken) {
      pageToken = data.nextPageToken;
      continue;
    }
    nextSyncToken = data.nextSyncToken ?? null;
    break;
  }

  return { events, nextSyncToken, needsFullResync: false };
}

/** The calendars the connected account can see (needs the full calendar scope we already ask for). */
export async function listGoogleCalendars(accessToken: string): Promise<{ id: string; name: string; primary: boolean; canEdit: boolean }[]> {
  const out: { id: string; name: string; primary: boolean; canEdit: boolean }[] = [];
  let pageToken: string | undefined;
  for (;;) {
    const url = new URL(`${CALENDAR_BASE}/users/me/calendarList`);
    url.searchParams.set("maxResults", "250");
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!res.ok) throw new Error(`Google Calendar list failed: ${res.status}`);
    const data = (await res.json()) as { items?: { id: string; summary?: string; summaryOverride?: string; primary?: boolean; accessRole?: string }[]; nextPageToken?: string };
    for (const c of data.items ?? []) out.push({ id: c.id, name: c.summaryOverride || c.summary || c.id, primary: !!c.primary, canEdit: c.accessRole === "owner" || c.accessRole === "writer" });
    if (!data.nextPageToken) break;
    pageToken = data.nextPageToken;
  }
  return out;
}

export function isOwnEvent(event: GoogleEventListResult["events"][number]) {
  return event.extendedProperties?.private?.source === SOURCE_TAG;
}
