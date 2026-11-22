import { describe, expect, it } from "vitest";
import { gigRange, MAX_RANGE_DAYS } from "@/lib/data/my-gigs";

describe("gigRange", () => {
  it("accepts past and future month windows", () => {
    expect(gigRange("2026-04-24", "2026-06-07")).toEqual({ from: "2026-04-24", to: "2026-06-07" });
    expect(gigRange("2027-01-25", "2027-03-07")).toEqual({ from: "2027-01-25", to: "2027-03-07" });
  });
  it("falls back to the default for missing or bad input", () => {
    expect(gigRange(null, null)).toBeNull();
    expect(gigRange("2026-05-01", null)).toBeNull();
    expect(gigRange("May 1", "2026-05-31")).toBeNull();
    expect(gigRange("2026-06-01", "2026-05-01")).toBeNull();
  });
  it("caps very long ranges", () => {
    const r = gigRange("2026-01-01", "2027-12-31");
    expect(r?.from).toBe("2026-01-01");
    expect((Date.parse(r!.to) - Date.parse(r!.from)) / 86400000 + 1).toBe(MAX_RANGE_DAYS);
  });
});
