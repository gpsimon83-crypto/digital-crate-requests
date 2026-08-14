import { createAdminClient } from "@/lib/supabase/admin";

export interface CrateRequestEventSummary {
  eventId: string;
  eventCode: string;
  title: string | null;
  startsAt: string | null;
  status: string;
  djName: string | null;
  requestCount: number;
  paidRequestCents: number;
  boostCents: number;
  tipCents: number;
}

interface EventJoinRow {
  id: string;
  event_code: string;
  title: string | null;
  starts_at: string | null;
  status: string;
  djs: { display_name: string } | null;
}

/**
 * Cross-event Crate Request activity, for the admin rollup — no dedicated
 * per-event view of this exists outside the assigned DJ's own live pages
 * today. Aggregated the same way listEvents() aggregates payments: one
 * extra query per source table, summed into a Map, rather than N+1 queries
 * per event (cheap at this data volume, single round trip beyond it).
 */
export async function listCrateRequestSummary(): Promise<CrateRequestEventSummary[]> {
  const db = createAdminClient();
  const { data: events, error } = await db
    .from("events")
    .select("id, event_code, title, starts_at, status, djs(display_name)")
    .order("starts_at", { ascending: false });
  if (error) throw error;

  const { data: requests } = await db.from("song_requests").select("event_id, amount_cents, is_paid, boost_total_cents");
  const { data: tips } = await db.from("tips").select("event_id, amount_cents");

  interface Bucket {
    requestCount: number;
    paidRequestCents: number;
    boostCents: number;
    tipCents: number;
  }
  const byEvent = new Map<string, Bucket>();
  function bucket(eventId: string): Bucket {
    let b = byEvent.get(eventId);
    if (!b) {
      b = { requestCount: 0, paidRequestCents: 0, boostCents: 0, tipCents: 0 };
      byEvent.set(eventId, b);
    }
    return b;
  }
  for (const r of requests ?? []) {
    const b = bucket(r.event_id);
    b.requestCount += 1;
    if (r.is_paid) b.paidRequestCents += r.amount_cents ?? 0;
    b.boostCents += r.boost_total_cents ?? 0;
  }
  for (const t of tips ?? []) {
    bucket(t.event_id).tipCents += t.amount_cents ?? 0;
  }

  return ((events ?? []) as unknown as EventJoinRow[]).map((e) => {
    const b = byEvent.get(e.id) ?? { requestCount: 0, paidRequestCents: 0, boostCents: 0, tipCents: 0 };
    return {
      eventId: e.id,
      eventCode: e.event_code,
      title: e.title,
      startsAt: e.starts_at,
      status: e.status,
      djName: e.djs?.display_name ?? null,
      requestCount: b.requestCount,
      paidRequestCents: b.paidRequestCents,
      boostCents: b.boostCents,
      tipCents: b.tipCents
    };
  });
}
