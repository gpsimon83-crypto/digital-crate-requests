import { describe, expect, it } from "vitest";
import { parsePackageInput, priceLabel, toPublicCatalog, type AdminCatalog } from "@/lib/data/catalog";
import { changesAgreement, toDjOffer, type OfferRow } from "@/lib/data/offers";
import { parseOfferInput, readyToSend } from "@/lib/data/offer-input";

const CAT = (o: Partial<AdminCatalog> = {}): AdminCatalog => ({
  ready: true,
  categories: [
    { id: "c1", slug: "private-parties", name: "Private Parties", position: 1, is_active: true },
    { id: "c2", slug: "weddings", name: "Weddings", position: 0, is_active: true },
    { id: "c3", slug: "off", name: "Off", position: 2, is_active: false }
  ],
  packages: [
    { id: "p2", name: "Private Party Plus", description: "", price: 1150, hours: 5, features: [], is_active: true, pricing_type: "fixed", quote_before_payment: false, categories: [{ category_id: "c1", position: 1 }], included_addon_ids: [], payout_type: "percent", payout_percent: 55, payout_flat_cents: null, eligible_service_cents: null, third_party_fee_cents: null },
    { id: "p1", name: "Private Party DJ", description: "", price: 950, hours: 4, features: ["DJ & MC"], is_active: true, pricing_type: "fixed", quote_before_payment: false, categories: [{ category_id: "c1", position: 0 }], included_addon_ids: ["a1"], payout_type: "percent", payout_percent: 55, payout_flat_cents: null, eligible_service_cents: null, third_party_fee_cents: null },
    { id: "band", name: "Live Band + DJ", description: "", price: 6500, hours: null, features: [], is_active: true, pricing_type: "starting_at", quote_before_payment: true, categories: [{ category_id: "c1", position: 9 }, { category_id: "c2", position: 9 }], included_addon_ids: [], payout_type: "percent", payout_percent: 55, payout_flat_cents: null, eligible_service_cents: 270000, third_party_fee_cents: 300000 },
    { id: "old", name: "Old", description: "", price: 1, hours: null, features: [], is_active: false, pricing_type: "fixed", quote_before_payment: false, categories: [{ category_id: "c1", position: 2 }], included_addon_ids: [] }
  ],
  addons: [
    { id: "a1", name: "Room Uplighting", description: "", price: 350, position: 0, is_active: true, category_ids: [] },
    { id: "a2", name: "Monogram", description: "", price: 250, position: 1, is_active: false, category_ids: [] },
    { id: "a3", name: "Ceremony sound", description: "", price: 150, position: 2, is_active: true, category_ids: ["c2"] }
  ],
  ...o
});

describe("public catalog", () => {
  const pub = toPublicCatalog(CAT());
  it("lists active categories with packages, in order", () => {
    expect(pub.map((c) => c.slug)).toEqual(["private-parties", "weddings"]);
    expect(pub[0].packages.map((p) => p.id)).toEqual(["p1", "p2", "band"]);
  });
  it("shows one Live Band record in every category it's in", () => {
    expect(pub.filter((c) => c.packages.some((p) => p.id === "band")).length).toBe(2);
  });
  it("never includes payout or cost fields", () => {
    const json = JSON.stringify(pub);
    for (const k of ["payout", "eligible", "third_party", "flat_cents"]) expect(json).not.toContain(k);
  });
  it("hides inactive add-ons (monogram) and keeps category-only add-ons in their category", () => {
    expect(pub[0].addons.map((a) => a.name)).toEqual(["Room Uplighting"]);
    expect(pub[1].addons.map((a) => a.name)).toEqual(["Room Uplighting", "Ceremony sound"]);
  });
  it("marks included add-ons", () => {
    expect(pub[0].packages[0].included_addons).toEqual(["Room Uplighting"]);
  });
  it("labels prices", () => {
    expect(priceLabel({ pricing_type: "starting_at", price: 6500 })).toBe("Starting at $6,500");
    expect(priceLabel({ pricing_type: "quote", price: 0 })).toBe("Request a quote");
  });
});

describe("package edits", () => {
  it("refuses payout changes from someone without finance.manage", () => {
    expect(parsePackageInput({ payoutPercent: 70 }, { creating: false, canManagePayout: false }).ok).toBe(false);
    const ok = parsePackageInput({ price: "1,200".replace(",", ""), categoryIds: ["11111111-2222-4333-8444-555555555555"], payoutPercent: 55 }, { creating: false, canManagePayout: true });
    expect(ok.ok && ok.value.row).toEqual({ price: 1200, payout_percent: 55 });
  });
});

const offer = (o: Partial<OfferRow> = {}): OfferRow => ({
  id: "o1", event_id: "e1", dj_id: "d1", package_id: null, kind: "one_time", gig_ids: [], status: "offered", version: 1, revises_offer_id: null,
  payout_cents: 27500, client_price_cents: 50000, eligible_cents: null, third_party_fee_cents: 0, sourced: "company",
  basis: { companyShareCents: 22500, rule: { type: "flat" } }, scope: { arrival: "20:30", start: "21:00", end: "01:00", equipment: "House sound", extras: [], notes: null },
  sent_at: null, responded_at: null, created_at: "", updated_at: "", ...o
});
const ctx = { event: { id: "e1", title: "Kyotes Friday", event_type: "Bar", starts_at: "2026-12-04T03:00:00Z", ends_at: null, venues: { name: "Kyotes", city: "Madison" } }, gigs: [], previous: null, paidStatus: null };

describe("DJ offer view", () => {
  it("$500 bar night offered at $275 shows Your Payout: $275 and nothing internal", () => {
    const v = toDjOffer(offer(), ctx);
    expect(v.payoutCents).toBe(27500);
    const json = JSON.stringify(v);
    for (const k of ["50000", "22500", "client", "company", "basis", "sourced", "third"]) expect(json).not.toContain(k);
  });
  it("recurring: per date, with the covered dates and the total", () => {
    const gigs = [
      { id: "g1", gig_date: "2026-12-04", start_time: "21:00:00", end_time: "01:00:00" },
      { id: "g2", gig_date: "2026-12-11", start_time: "21:00:00", end_time: "01:00:00" },
      { id: "g3", gig_date: "2026-12-18", start_time: "21:00:00", end_time: "01:00:00" }
    ];
    const v = toDjOffer(offer({ kind: "recurring", gig_ids: ["g1", "g3"], payout_cents: 30000 }), { ...ctx, gigs });
    expect(v.payoutPerDate).toBe(true);
    expect(v.dates.map((d) => d.date)).toEqual(["2026-12-04", "2026-12-18"]);
    expect(v.totalCents).toBe(60000);
  });
  it("Offered → Accepted → Paid stays separate from the agreed payout", () => {
    expect(toDjOffer(offer(), ctx).payment).toBe("not_due");
    expect(toDjOffer(offer({ status: "accepted" }), ctx).payment).toBe("pending");
    expect(toDjOffer(offer({ status: "accepted" }), { ...ctx, paidStatus: "paid" }).payment).toBe("paid");
  });
});

describe("offer rules", () => {
  it("payout or scope changes need a new acceptance; internal changes don't", () => {
    const a = offer();
    expect(changesAgreement(a, { ...a, client_price_cents: 60000 } as OfferRow)).toBe(false);
    expect(changesAgreement(a, { ...a, payout_cents: 30000 })).toBe(true);
    expect(changesAgreement(a, { ...a, scope: { ...a.scope, equipment: "Bring your own speakers" } })).toBe(true);
  });
  it("a draft can skip the payout, sending can't", () => {
    const p = parseOfferInput({ djId: "11111111-2222-4333-8444-555555555555" });
    expect(p.ok).toBe(true);
    if (!p.ok) return;
    expect(readyToSend(p.value, null)).toMatch(/exact payout/);
    expect(readyToSend({ ...p.value, payout_cents: 148500 }, { quote_before_payment: true, pricing_type: "starting_at" })).toMatch(/confirmed client price/);
    expect(readyToSend({ ...p.value, payout_cents: 148500, client_price_cents: 650000 }, { quote_before_payment: true, pricing_type: "starting_at" })).toBeNull();
  });
});
