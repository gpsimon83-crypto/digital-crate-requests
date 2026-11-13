/**
 * Nights for a venue from the shared DCDJ Google Calendar, read through the
 * WordPress site (it holds the calendar connection and the DJ confirmations).
 * The request carries the same partner secret the site uses when it sends
 * inquiries here (INQUIRY_PARTNER_SECRET = DC_CRM_PARTNER_KEY in wp-config.php).
 *
 * The site only returns date, times, DJ and confirmation state: never event
 * titles, descriptions or client details.
 */

export type CalendarNight = {
  id: string;
  date: string;
  starts_at: string | null;
  ends_at: string | null;
  all_day: boolean;
  matched: string;
  state: "confirmed" | "tagged" | "open";
  dj: { name: string; photo_url: string | null } | null;
};

export type CalendarFeedResult = { nights: CalendarNight[]; status: "ok" | "off" | "error" };

const SITE = (process.env.WP_SITE_URL || "https://digitalcratedjs.com").replace(/\/+$/, "");

function clean(n: unknown): CalendarNight | null {
  if (!n || typeof n !== "object") return null;
  const r = n as Record<string, unknown>;
  const date = String(r.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const iso = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);
  const djRaw = r.dj && typeof r.dj === "object" ? (r.dj as Record<string, unknown>) : null;
  const photo = djRaw && typeof djRaw.photo_url === "string" && /^https:\/\//.test(djRaw.photo_url) ? djRaw.photo_url : null;
  const state = r.state === "confirmed" || r.state === "tagged" ? r.state : "open";
  return {
    id: String(r.id ?? "").replace(/[^a-z0-9_]/gi, "").slice(0, 40) || `gcal_${date}`,
    date,
    starts_at: iso(r.starts_at),
    ends_at: iso(r.ends_at),
    all_day: !!r.all_day,
    matched: String(r.matched ?? "").slice(0, 80),
    state,
    dj: djRaw && typeof djRaw.name === "string" && djRaw.name.trim() ? { name: djRaw.name.trim().slice(0, 80), photo_url: photo } : null
  };
}

/** `months` consecutive months starting at `month` (YYYY-MM), 1–3. Never throws. */
export async function fetchVenueNights(names: string[], month: string, months = 1): Promise<CalendarFeedResult> {
  const secret = process.env.INQUIRY_PARTNER_SECRET ?? "";
  const list = names.map((n) => n.trim()).filter((n) => n.length >= 2 && !n.includes("|"));
  if (!list.length) return { nights: [], status: "ok" };
  if (secret.length < 32) return { nights: [], status: "off" };

  const url = new URL(`${SITE}/wp-json/dcdj/v1/venue-nights`);
  url.searchParams.set("names", list.join("|"));
  url.searchParams.set("month", month);
  url.searchParams.set("months", String(Math.max(1, Math.min(3, months))));
  try {
    const res = await fetch(url, {
      headers: { "x-dcdj-partner-key": secret, accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000)
    });
    if (!res.ok) return { nights: [], status: res.status === 503 ? "off" : "error" };
    const body = (await res.json()) as { nights?: unknown[] };
    return { nights: (body.nights ?? []).map(clean).filter((n): n is CalendarNight => !!n), status: "ok" };
  } catch {
    return { nights: [], status: "error" };
  }
}
