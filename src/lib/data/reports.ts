import { createAdminClient } from "@/lib/supabase/admin";

export type ReportRange = "last_6_months" | "last_12_months" | "this_year" | "last_year" | "all_time";
export const REPORT_RANGES: ReportRange[] = ["last_6_months", "last_12_months", "this_year", "last_year", "all_time"];

const WON_STATUSES = new Set(["confirmed", "live", "ended"]);

function rangeToDates(range: ReportRange): { from: Date | null; to: Date } {
  const now = new Date();
  switch (range) {
    case "last_6_months":
      return { from: new Date(now.getFullYear(), now.getMonth() - 5, 1), to: now };
    case "last_12_months":
      return { from: new Date(now.getFullYear(), now.getMonth() - 11, 1), to: now };
    case "this_year":
      return { from: new Date(now.getFullYear(), 0, 1), to: now };
    case "last_year":
      return { from: new Date(now.getFullYear() - 1, 0, 1), to: new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59) };
    case "all_time":
      return { from: null, to: now };
  }
}

function monthKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

interface EventRow {
  id: string;
  event_type: string | null;
  status: string;
  starts_at: string | null;
  created_at: string;
  quoted_amount: number | null;
  final_amount: number | null;
  dj_id: string | null;
  djs: { display_name: string } | null;
  client_id: string | null;
  clients: { referral_source: string | null } | null;
}

function dealValueCents(e: { quoted_amount: number | null; final_amount: number | null }) {
  return Math.round((e.final_amount ?? e.quoted_amount ?? 0) * 100);
}

export async function getReportsSummary(range: ReportRange) {
  const db = createAdminClient();
  const { from, to } = rangeToDates(range);
  const inRange = (dateStr: string | null) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    if (from && d < from) return false;
    return d <= to;
  };

  const { data: eventsData, error } = await db
    .from("events")
    .select(
      "id, event_type, status, starts_at, created_at, quoted_amount, final_amount, dj_id, djs(display_name), client_id, clients(referral_source)"
    );
  if (error) throw error;
  const events = eventsData as unknown as EventRow[];

  // Revenue trend + DJ performance + event types are scoped by when the
  // GIG happens (starts_at); lead conversion is scoped by when the LEAD
  // came in (created_at) — different date semantics, same range window.
  const bookedEvents = events.filter((e) => inRange(e.starts_at) && e.status !== "declined");
  const leadEvents = events.filter((e) => inRange(e.created_at) && e.client_id);

  const bookedByMonth = new Map<string, number>();
  for (const e of bookedEvents) {
    const key = monthKey(new Date(e.starts_at as string));
    bookedByMonth.set(key, (bookedByMonth.get(key) ?? 0) + dealValueCents(e));
  }

  let paymentsQuery = db.from("payments").select("amount_cents, paid_at").eq("status", "succeeded").not("paid_at", "is", null).lte("paid_at", to.toISOString());
  if (from) paymentsQuery = paymentsQuery.gte("paid_at", from.toISOString());
  const { data: payments } = await paymentsQuery;
  const collectedByMonth = new Map<string, number>();
  for (const p of payments ?? []) {
    const key = monthKey(new Date(p.paid_at as string));
    collectedByMonth.set(key, (collectedByMonth.get(key) ?? 0) + p.amount_cents);
  }

  const allMonthKeys = new Set([...bookedByMonth.keys(), ...collectedByMonth.keys()]);
  const revenueTrend = [...allMonthKeys]
    .sort()
    .map((month) => ({ month, bookedCents: bookedByMonth.get(month) ?? 0, collectedCents: collectedByMonth.get(month) ?? 0 }));

  // One row per client, keyed by their earliest event in the range — avoids
  // double-counting a client who's booked more than once.
  const leadsByClient = new Map<string, EventRow>();
  for (const e of leadEvents) {
    const existing = leadsByClient.get(e.client_id as string);
    if (!existing || new Date(e.created_at) < new Date(existing.created_at)) {
      leadsByClient.set(e.client_id as string, e);
    }
  }
  const sourceStats = new Map<string, { total: number; won: number; lost: number; pending: number }>();
  let won = 0,
    lost = 0,
    pending = 0;
  for (const e of leadsByClient.values()) {
    const source = e.clients?.referral_source || "Unknown";
    const bucket = sourceStats.get(source) ?? { total: 0, won: 0, lost: 0, pending: 0 };
    bucket.total += 1;
    if (e.status === "declined") {
      bucket.lost += 1;
      lost += 1;
    } else if (WON_STATUSES.has(e.status)) {
      bucket.won += 1;
      won += 1;
    } else {
      bucket.pending += 1;
      pending += 1;
    }
    sourceStats.set(source, bucket);
  }
  const leadConversion = {
    total: leadsByClient.size,
    won,
    lost,
    pending,
    bySource: [...sourceStats.entries()].map(([source, s]) => ({ source, ...s })).sort((a, b) => b.total - a.total)
  };

  const djStats = new Map<string, { name: string; gigs: number; revenueCents: number }>();
  for (const e of bookedEvents) {
    if (!e.dj_id) continue;
    const bucket = djStats.get(e.dj_id) ?? { name: e.djs?.display_name ?? "Unknown DJ", gigs: 0, revenueCents: 0 };
    bucket.gigs += 1;
    bucket.revenueCents += dealValueCents(e);
    djStats.set(e.dj_id, bucket);
  }
  const djPerformance = [...djStats.entries()]
    .map(([djId, s]) => ({ djId, djName: s.name, gigs: s.gigs, revenueCents: s.revenueCents, avgDealCents: s.gigs ? Math.round(s.revenueCents / s.gigs) : 0 }))
    .sort((a, b) => b.revenueCents - a.revenueCents);

  const typeStats = new Map<string, { count: number; revenueCents: number }>();
  for (const e of bookedEvents) {
    const type = e.event_type || "Other";
    const bucket = typeStats.get(type) ?? { count: 0, revenueCents: 0 };
    bucket.count += 1;
    bucket.revenueCents += dealValueCents(e);
    typeStats.set(type, bucket);
  }
  const eventTypes = [...typeStats.entries()].map(([type, s]) => ({ type, ...s })).sort((a, b) => b.revenueCents - a.revenueCents);

  return { revenueTrend, leadConversion, djPerformance, eventTypes };
}
