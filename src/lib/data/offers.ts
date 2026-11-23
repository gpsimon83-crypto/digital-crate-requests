import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * DJ offers: the exact payout and scope a DJ agrees to for a gig (one-time)
 * or a set of residency dates (recurring, paid per date).
 *
 * - Drafts can be saved without a payout (quote-based jobs); sending needs an
 *   exact payout and a DJ.
 * - Once sent, an offer is never edited: a change makes a new version that
 *   the DJ accepts again. A revision of an accepted offer leaves the accepted
 *   one in force until the revision is accepted; every version is kept.
 * - The agreed payout is separate from payment: a payouts row (Finance)
 *   records Pending/Paid for it.
 * - DJs only ever get `toDjOffer`: no client price, company share, band fee
 *   or split rule.
 */

export type OfferStatus = "draft" | "offered" | "accepted" | "declined" | "withdrawn" | "superseded";
export type OfferKind = "one_time" | "recurring";
export type OfferExtra = { label: string; payoutCents: number };
export type OfferScope = {
  arrival?: string | null;
  start?: string | null;
  end?: string | null;
  equipment?: string | null;
  extras?: OfferExtra[];
  notes?: string | null;
};

export type OfferRow = {
  id: string;
  event_id: string;
  dj_id: string | null;
  package_id: string | null;
  kind: OfferKind;
  gig_ids: string[];
  status: OfferStatus;
  version: number;
  revises_offer_id: string | null;
  payout_cents: number | null;
  client_price_cents: number | null;
  eligible_cents: number | null;
  third_party_fee_cents: number | null;
  sourced: "company" | "dj";
  basis: Record<string, unknown>;
  scope: OfferScope;
  sent_at: string | null;
  responded_at: string | null;
  created_at: string;
  updated_at: string;
};

/** What the DJ sees on an offer, plus where it stands for payment. */
export type DjOffer = {
  id: string;
  version: number;
  kind: OfferKind;
  status: "offered" | "accepted" | "declined" | "superseded";
  /** Whole gig (one-time) or each date (recurring). */
  payoutCents: number;
  payoutPerDate: boolean;
  /** Total across the covered dates (recurring) or the gig payout (one-time). */
  totalCents: number;
  /** What they had agreed to before this revision, if it's a revision of one they accepted. */
  previousPayoutCents: number | null;
  payment: "not_due" | "pending" | "paid";
  event: { id: string; title: string; type: string | null; startsAt: string | null; endsAt: string | null; venue: string | null; venueCity: string | null };
  dates: { date: string; start: string; end: string }[];
  scope: OfferScope;
  sentAt: string | null;
  respondedAt: string | null;
};

const clean = (v: unknown, max: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const time = (v: unknown) => (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : null);

/** Scope as saved: times as HH:MM, short text, paid extras with whole-cent amounts. */
export function cleanScope(v: unknown): OfferScope {
  const s = (v && typeof v === "object" ? v : {}) as Record<string, unknown>;
  const extras = Array.isArray(s.extras)
    ? (s.extras as unknown[])
        .map((e) => (e && typeof e === "object" ? (e as Record<string, unknown>) : {}))
        .map((e) => ({ label: clean(e.label, 120) ?? "", payoutCents: Math.max(0, Math.round(Number(e.payoutCents) || 0)) }))
        .filter((e) => e.label)
        .slice(0, 20)
    : [];
  return { arrival: time(s.arrival), start: time(s.start), end: time(s.end), equipment: clean(s.equipment, 2000), extras, notes: clean(s.notes, 2000) };
}

/** Payout + scope are what the DJ agrees to; a change to either needs a new acceptance. */
export function changesAgreement(a: Pick<OfferRow, "payout_cents" | "scope" | "gig_ids" | "dj_id" | "kind">, b: Pick<OfferRow, "payout_cents" | "scope" | "gig_ids" | "dj_id" | "kind">) {
  const norm = (o: typeof a) => JSON.stringify([o.payout_cents, o.dj_id, o.kind, [...(o.gig_ids ?? [])].sort(), cleanScope(o.scope)]);
  return norm(a) !== norm(b);
}

export function toDjOffer(
  o: OfferRow,
  ctx: {
    event: { id: string; title: string; event_type: string | null; starts_at: string | null; ends_at: string | null; venue_name?: string | null; venues?: { name: string | null; city?: string | null } | null };
    gigs: { id: string; gig_date: string; start_time: string; end_time: string }[];
    previous: OfferRow | null;
    paidStatus: "pending" | "paid" | null;
  }
): DjOffer {
  const dates = o.kind === "recurring" ? ctx.gigs.filter((g) => o.gig_ids.includes(g.id)).map((g) => ({ date: g.gig_date, start: g.start_time.slice(0, 5), end: g.end_time.slice(0, 5) })).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const payout = o.payout_cents ?? 0;
  return {
    id: o.id,
    version: o.version,
    kind: o.kind,
    status: o.status as DjOffer["status"],
    payoutCents: payout,
    payoutPerDate: o.kind === "recurring",
    totalCents: o.kind === "recurring" ? payout * dates.length : payout,
    previousPayoutCents: ctx.previous?.status === "accepted" ? ctx.previous.payout_cents : null,
    payment: o.status !== "accepted" ? "not_due" : ctx.paidStatus === "paid" ? "paid" : "pending",
    event: { id: ctx.event.id, title: ctx.event.title, type: ctx.event.event_type, startsAt: ctx.event.starts_at, endsAt: ctx.event.ends_at, venue: ctx.event.venues?.name ?? ctx.event.venue_name ?? null, venueCity: ctx.event.venues?.city ?? null },
    dates,
    scope: cleanScope(o.scope),
    sentAt: o.sent_at,
    respondedAt: o.responded_at
  };
}

/** Offers a DJ can see: sent ones (not drafts or withdrawn), newest version per chain first. */
export async function djOffers(db: Db, djId: string): Promise<DjOffer[]> {
  const { data, error } = await db.from("dj_offers").select("*").eq("dj_id", djId).in("status", ["offered", "accepted", "declined", "superseded"]).order("created_at", { ascending: false }).limit(200);
  if (error) throw error;
  const offers = (data ?? []) as OfferRow[];
  if (!offers.length) return [];
  const eventIds = [...new Set(offers.map((o) => o.event_id))];
  const prevIds = offers.map((o) => o.revises_offer_id).filter((x): x is string => !!x);
  const [ev, gigs, prev, pays] = await Promise.all([
    db.from("events").select("id, title, event_type, starts_at, ends_at, venue_name, venues(name, city)").in("id", eventIds),
    db.from("residency_gigs").select("id, gig_date, start_time, end_time").in("event_id", eventIds),
    prevIds.length ? db.from("dj_offers").select("*").in("id", prevIds) : Promise.resolve({ data: [], error: null }),
    db.from("payouts").select("offer_id, status").in("offer_id", offers.map((o) => o.id))
  ]);
  const events = new Map(((ev.data ?? []) as unknown as Parameters<typeof toDjOffer>[1]["event"][]).map((e) => [e.id, e]));
  const prevById = new Map(((prev.data ?? []) as OfferRow[]).map((p) => [p.id, p]));
  const paid = new Map<string, "pending" | "paid">();
  for (const p of (pays.data ?? []) as { offer_id: string; status: string }[]) paid.set(p.offer_id, p.status === "paid" && paid.get(p.offer_id) !== "pending" ? "paid" : "pending");
  // Superseded versions are history; keep them only if nothing newer in the chain is visible.
  const newer = new Set(offers.map((o) => o.revises_offer_id).filter(Boolean));
  return offers
    .filter((o) => events.has(o.event_id) && !(o.status === "superseded" && newer.has(o.id)))
    .map((o) => toDjOffer(o, { event: events.get(o.event_id)!, gigs: (gigs.data ?? []) as { id: string; gig_date: string; start_time: string; end_time: string }[], previous: o.revises_offer_id ? (prevById.get(o.revises_offer_id) ?? null) : null, paidStatus: paid.get(o.id) ?? null }));
}
