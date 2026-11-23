import { describe, expect, it } from "vitest";
import { computePayout, dollars, parseDollars } from "@/lib/payouts/rule";

const pct = (percent = 55) => ({ type: "percent" as const, percent, flatCents: null });

describe("computePayout", () => {
  it("$1,800 Hits Wedding: $990 DJ, $810 DCDJs", () => {
    const r = computePayout({ rule: pct(), clientPriceCents: 180000 });
    expect(r.payoutCents).toBe(99000);
    expect(r.companyShareCents).toBe(81000);
  });
  it("$950 Private Party: $522.50 DJ, $427.50 DCDJs", () => {
    const r = computePayout({ rule: pct(), clientPriceCents: 95000 });
    expect(r.payoutCents).toBe(52250);
    expect(r.companyShareCents).toBe(42750);
  });
  it("$500 bar night at $275 flat leaves $225", () => {
    const r = computePayout({ rule: { type: "flat", percent: 55, flatCents: 27500 }, clientPriceCents: 50000 });
    expect(r.payoutCents).toBe(27500);
    expect(r.companyShareCents).toBe(22500);
  });
  it("$6,500 band booking: $2,700 DJ service at 55% is $1,485; $3,000 band fee leaves $2,015", () => {
    const r = computePayout({ rule: pct(), clientPriceCents: 650000, eligibleCents: 270000, thirdPartyFeeCents: 300000 });
    expect(r.payoutCents).toBe(148500);
    expect(r.companyShareCents).toBe(201500);
  });
  it("DJ-sourced bookings use 65/35", () => {
    const r = computePayout({ rule: pct(), clientPriceCents: 100000, sourced: "dj" });
    expect(r.percentApplied).toBe(65);
    expect(r.payoutCents).toBe(65000);
  });
  it("takes the service discount off the base and adds included extras and flat amounts", () => {
    const r = computePayout({ rule: pct(50), clientPriceCents: 100000, discountCents: 10000, includedExtrasCents: 20000, flatAddCents: 5000 });
    expect(r.baseCents).toBe(110000);
    expect(r.payoutCents).toBe(60000);
    expect(r.companyShareCents).toBe(100000 - 10000 - 60000);
  });
});

describe("money helpers", () => {
  it("formats and parses dollars", () => {
    expect(dollars(52250)).toBe("$522.50");
    expect(dollars(99000)).toBe("$990");
    expect(parseDollars("$1,150")).toBe(115000);
    expect(parseDollars("")).toBeNull();
    expect(parseDollars("abc")).toBeNull();
  });
});
