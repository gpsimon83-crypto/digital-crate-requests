import { describe, expect, it } from "vitest";
import { categorySlugFor, needsFromEventBasics, needsFromProject, needsFromWeddingBasics, recommendFromCatalog, type EventNeeds } from "@/lib/catalog-recommend";
import type { AdminCatalog, AdminPackage } from "@/lib/data/catalog";

const pkg = (id: string, name: string, price: number, hours: number | null, cat: string, o: Partial<AdminPackage> = {}): AdminPackage => ({
  id, name, description: "", price, hours, features: [], is_active: true, pricing_type: "fixed", quote_before_payment: false, categories: [{ category_id: cat, position: 0 }], included_addon_ids: [], ...o
});
const CATALOG: AdminCatalog = {
  ready: true,
  categories: [
    { id: "pp", slug: "private-parties", name: "Private Parties", position: 1, is_active: true },
    { id: "w", slug: "weddings", name: "Weddings", position: 0, is_active: true },
    { id: "b", slug: "bars-nightlife", name: "Bars & Nightlife", position: 2, is_active: true },
    { id: "s", slug: "school-events", name: "School Events", position: 3, is_active: true }
  ],
  packages: [
    pkg("ppdj", "Private Party DJ", 950, 4, "pp", { features: ["DJ & MC", "Wireless microphone"] }),
    pkg("ppplus", "Private Party Plus", 1150, 5, "pp", { features: ["Everything in Private Party DJ", "One more hour"] }),
    pkg("ppsig", "Private Party Signature", 1650, 6, "pp", { included_addon_ids: ["up"], features: ["Room uplighting"] }),
    pkg("band", "Live Band + DJ", 6500, null, "pp", { pricing_type: "starting_at", quote_before_payment: true }),
    pkg("hits", "The Hits DJ Package", 1800, 6, "w"),
    pkg("elite", "Elite DJ Package", 2700, 8, "w"),
    pkg("bar", "Bar Night – House Sound", 500, 4, "b", { features: ["Plays through your house sound system"] }),
    pkg("res", "Bar Residency", 0, null, "b", { pricing_type: "quote" }),
    pkg("sd", "School Dance DJ", 1200, 4, "s", { features: ["Clean music only"] }),
    pkg("large", "Large School Event DJ", 2100, 5, "s", { pricing_type: "starting_at", features: ["Expanded sound coverage", "Clean music only"] })
  ],
  addons: [
    { id: "up", name: "Room Uplighting", description: "", price: 350, position: 0, is_active: true, category_ids: [] },
    { id: "cer", name: "Ceremony", description: "", price: 250, position: 1, is_active: true, category_ids: [] },
    { id: "ck", name: "Cocktail Hour", description: "", price: 200, position: 2, is_active: true, category_ids: [] },
    { id: "mic", name: "Wireless Headset Microphones", description: "", price: 50, position: 3, is_active: true, category_ids: [] }
  ]
};
const needs = (o: Partial<EventNeeds>): EventNeeds => ({ category: "private-parties", guests: 80, hoursNeeded: 4, wants: [], outdoors: false, setupAccess: null, recurring: false, source: "event_basics", ...o });

describe("recommendFromCatalog", () => {
  it("4-hour party → Private Party DJ at $950", () => {
    const r = recommendFromCatalog(CATALOG, needs({}));
    expect(r.options[0]).toMatchObject({ name: "Private Party DJ", estimateCents: 95000, best: true });
  });
  it("5 hours → Plus; 6 hours with uplighting → Signature with uplighting Included (no double charge)", () => {
    expect(recommendFromCatalog(CATALOG, needs({ hoursNeeded: 5 })).options[0].name).toBe("Private Party Plus");
    const sig = recommendFromCatalog(CATALOG, needs({ hoursNeeded: 6, wants: ["uplighting"] })).options[0];
    expect(sig.name).toBe("Private Party Signature");
    expect(sig.addOns).toEqual([expect.objectContaining({ name: "Room Uplighting", included: true, priceCents: 0 })]);
    expect(sig.estimateCents).toBe(165000);
  });
  it("5 hours + uplighting: Plus with the $350 add-on ($1,500) beats Signature ($1,650)", () => {
    const o = recommendFromCatalog(CATALOG, needs({ hoursNeeded: 5, wants: ["uplighting"] })).options[0];
    expect(o).toMatchObject({ name: "Private Party Plus", estimateCents: 150000 });
  });
  it("adds an add-on's price when the package doesn't include it", () => {
    const o = recommendFromCatalog(CATALOG, needs({ hoursNeeded: 4, wants: ["uplighting"] })).options.find((x) => x.name === "Private Party DJ")!;
    expect(o.estimateCents).toBe(95000 + 35000);
  });
  it("mic already in the features counts as included", () => {
    const o = recommendFromCatalog(CATALOG, needs({ wants: ["mic"] })).options[0];
    expect(o.addOns[0]).toMatchObject({ included: true, priceCents: 0 });
  });
  it("flags a shortfall when no package covers the hours", () => {
    const r = recommendFromCatalog(CATALOG, needs({ hoursNeeded: 8 }));
    expect(r.options[0].name).toBe("Private Party Signature");
    expect(r.options[0].watch.join(" ")).toMatch(/2 more/);
  });
  it("leaves the live band out when regular packages exist", () => {
    expect(recommendFromCatalog(CATALOG, needs({ hoursNeeded: null })).options.map((o) => o.name)).not.toContain("Live Band + DJ");
  });
  it("follows 'Everything in …': Plus includes the DJ package's wireless mic", () => {
    const o = recommendFromCatalog(CATALOG, needs({ hoursNeeded: 5, wants: ["mic"] })).options[0];
    expect(o.name).toBe("Private Party Plus");
    expect(o.addOns[0]).toMatchObject({ included: true, priceCents: 0 });
  });
  it("wedding: ceremony and cocktail hour priced on top", () => {
    const o = recommendFromCatalog(CATALOG, needs({ category: "weddings", hoursNeeded: 6, wants: ["ceremony", "cocktail"] })).options[0];
    expect(o.name).toBe("The Hits DJ Package");
    expect(o.estimateCents).toBe(180000 + 25000 + 20000);
  });
  it("bars: one night → Bar Night $500; recurring → Residency (quote)", () => {
    expect(recommendFromCatalog(CATALOG, needs({ category: "bars-nightlife", setupAccess: "house_sound" })).options[0]).toMatchObject({ name: "Bar Night – House Sound", estimateCents: 50000 });
    expect(recommendFromCatalog(CATALOG, needs({ category: "bars-nightlife", recurring: true, hoursNeeded: null })).options[0]).toMatchObject({ name: "Bar Residency", estimateCents: null, estimateOnly: true });
  });
  it("school: 450 guests → Large School Event (starting at, flagged)", () => {
    const o = recommendFromCatalog(CATALOG, needs({ category: "school-events", guests: 450, hoursNeeded: 5 })).options[0];
    expect(o).toMatchObject({ name: "Large School Event DJ", estimateOnly: true });
  });
});

describe("needs from answers", () => {
  it("Event Basics: hours across midnight, wants", () => {
    const n = needsFromEventBasics({ start_time: { value: "20:00" }, end_time: { value: "00:30" }, guest_count: { value: "120" }, needs: { value: ["mic", "uplighting"] }, indoor_outdoor: { value: "both" } });
    expect(n).toMatchObject({ hoursNeeded: 4.5, guests: 120, wants: ["mic", "uplighting"], outdoors: true });
  });
  it("Wedding Basics: ceremony + cocktail add time and wants", () => {
    const n = needsFromWeddingBasics({ reception_start: { value: "17:00" }, reception_end: { value: "22:00" }, coverage: { value: ["ceremony", "cocktail", "reception"] }, guest_count: { value: "150" } });
    expect(n.hoursNeeded).toBe(6.5);
    expect(n.wants).toEqual(["ceremony", "mic", "cocktail"]);
  });
  it("project fallback and category mapping", () => {
    expect(needsFromProject({ expected_guests: 90, starts_at: "2026-12-05T01:00:00Z", ends_at: "2026-12-05T05:00:00Z" })).toMatchObject({ guests: 90, hoursNeeded: 4 });
    expect(categorySlugFor("bar_nightclub")).toBe("bars-nightlife");
    expect(categorySlugFor(null, "Prom")).toBe("school-events");
    expect(categorySlugFor("holiday")).toBe("private-parties");
  });
});
