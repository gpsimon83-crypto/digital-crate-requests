import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireAdmin } from "@/lib/require-admin";

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const db = createAdminClient();

    const [tipsRes, boostsRes, requestsRes, eventsRes, djsRes, venuesRes] = await Promise.all([
      db.from("tips").select("amount_cents, dj_id, event_id"),
      db.from("boosts").select("amount_cents"),
      db.from("song_requests").select("amount_cents, payment_status, genre"),
      db.from("events").select("id, dj_id, venue_id, status, djs(display_name), venues(name)"),
      db.from("djs").select("id, display_name"),
      db.from("venues").select("id, name"),
    ]);

    const tips = tipsRes.data ?? [];
    const boosts = boostsRes.data ?? [];
    const requests = requestsRes.data ?? [];
    const events = eventsRes.data ?? [];

    const totalTipsCents = tips.reduce((s, t) => s + (t.amount_cents ?? 0), 0);
    const totalBoostsCents = boosts.reduce((s, b) => s + (b.amount_cents ?? 0), 0);
    const totalPaidRequestsCents = requests
      .filter((r) => r.payment_status === "captured")
      .reduce((s, r) => s + (r.amount_cents ?? 0), 0);

    const eventCountByDj = new Map<string, { name: string; count: number }>();
    const eventCountByVenue = new Map<string, { name: string; count: number }>();
    interface EventJoinRow {
      dj_id: string | null;
      venue_id: string | null;
      djs: { display_name: string } | { display_name: string }[] | null;
      venues: { name: string } | { name: string }[] | null;
    }

    for (const e of events as unknown as EventJoinRow[]) {
      const djInfo = Array.isArray(e.djs) ? e.djs[0] : e.djs;
      const venueInfo = Array.isArray(e.venues) ? e.venues[0] : e.venues;

      if (e.dj_id) {
        const entry = eventCountByDj.get(e.dj_id) ?? { name: djInfo?.display_name ?? "Unknown", count: 0 };
        entry.count++;
        eventCountByDj.set(e.dj_id, entry);
      }
      if (e.venue_id) {
        const entry = eventCountByVenue.get(e.venue_id) ?? { name: venueInfo?.name ?? "Unknown", count: 0 };
        entry.count++;
        eventCountByVenue.set(e.venue_id, entry);
      }
    }

    const topDjs = [...eventCountByDj.values()].sort((a, b) => b.count - a.count).slice(0, 5);
    const topVenues = [...eventCountByVenue.values()].sort((a, b) => b.count - a.count).slice(0, 5);

    return NextResponse.json({
      totals: {
        totalTipsCents,
        totalBoostsCents,
        totalPaidRequestsCents,
        totalRequests: requests.length,
        totalEvents: events.length,
        totalDjs: (djsRes.data ?? []).length,
        totalVenues: (venuesRes.data ?? []).length,
      },
      topDjs,
      topVenues,
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
