import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireVenueAdmin } from "@/lib/venue/server";
import { fetchVenueNights } from "@/lib/venue/calendar-feed";
import { isDjName, venueSearchNames, type CalendarDjName } from "@/lib/venue/calendar-options";

type Params = { params: Promise<{ id: string }> };

/**
 * Admin "Test calendar link": what the venue portal would get from the shared
 * DCDJ calendar for this venue right now (this month and the next two), and why
 * not when nothing comes back. Never shows the partner key itself.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  try {
    const db = createAdminClient();
    const { data: venue, error } = await db.from("venues").select("id, name, calendar_names").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!venue) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
    const saved = ((venue.calendar_names as string[] | null) ?? []).filter(Boolean);
    const { data: djRows } = await db.from("calendar_dj_names").select("id, calendar_name, display_name");
    const djs = (djRows ?? []) as CalendarDjName[];
    const names = venueSearchNames(venue.name as string, saved, djs);
    const ignored = saved.filter((n) => isDjName(n, djs));
    const month = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
    const secret = process.env.INQUIRY_PARTNER_SECRET ?? "";
    const feed = names.length ? await fetchVenueNights(names, month, 3) : { nights: [], status: "ok" as const, http: undefined };

    let reason = "";
    if (!names.length) reason = "no-names";
    else if (secret.length < 32) reason = "no-key";
    else if (feed.http === 401) reason = "key-mismatch";
    else if (feed.http === 503) reason = "site-key-missing";
    else if (feed.http === 404) reason = "site-not-updated";
    else if (feed.http === 502) reason = "site-calendar-error";
    else if (feed.status === "error") reason = feed.http ? `site-error-${feed.http}` : "site-unreachable";
    else if (!feed.nights.length) reason = "no-matches";

    return NextResponse.json({
      names,
      ignored,
      month,
      keySet: secret.length >= 32,
      http: feed.http ?? null,
      status: feed.status,
      reason,
      count: feed.nights.length,
      sample: feed.nights.slice(0, 6).map((n) => ({ date: n.date, matched: n.matched, dj: n.dj?.name ?? null, dj_text: n.dj_text, state: n.state }))
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
