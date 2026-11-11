import { describe, expect, it } from "vitest";
import { businessToday, checkPublicEventDate, isPastEventDate, isValidDateString, PAST_DATE_MESSAGE } from "@/lib/security/business-date";
import { inquirySchema, describeIssues } from "@/lib/security/inquiry-validation";
import { zonedTimeToUtc, utcToZonedDateStr } from "@/lib/scheduler-time";

// 2026-11-11 noon in Chicago (CST, UTC-6)
const NOON = new Date("2026-11-11T18:00:00Z");

describe("past event dates (America/Chicago)", () => {
  it("rejects yesterday, allows today and tomorrow", () => {
    expect(checkPublicEventDate("2026-11-10", NOON)).toBe(PAST_DATE_MESSAGE);
    expect(checkPublicEventDate("2026-11-11", NOON)).toBeNull();
    expect(checkPublicEventDate("2026-11-12", NOON)).toBeNull();
  });

  it("uses the exact message", () => {
    expect(PAST_DATE_MESSAGE).toBe("Please select today or a future date. Past event dates cannot be submitted.");
  });

  it("11:59 PM Chicago is still the same day even though UTC is already tomorrow", () => {
    const lateNight = new Date("2026-11-12T05:59:59Z"); // 11:59:59 PM Nov 11 CST
    expect(businessToday(lateNight)).toBe("2026-11-11");
    expect(isPastEventDate("2026-11-11", lateNight)).toBe(false);
    expect(isPastEventDate("2026-11-10", lateNight)).toBe(true);
  });

  it("12:00 AM Chicago starts the new day, so a form left open overnight can't submit yesterday", () => {
    const justAfterMidnight = new Date("2026-11-12T06:00:00Z"); // 12:00:00 AM Nov 12 CST
    expect(businessToday(justAfterMidnight)).toBe("2026-11-12");
    // Picked "today" at 11:58 PM, submitted at 12:00 AM: now yesterday.
    expect(checkPublicEventDate("2026-11-11", new Date("2026-11-12T05:58:00Z"))).toBeNull();
    expect(checkPublicEventDate("2026-11-11", justAfterMidnight)).toBe(PAST_DATE_MESSAGE);
    expect(checkPublicEventDate("2026-11-12", justAfterMidnight)).toBeNull();
  });

  it("is right across daylight-saving changes", () => {
    // 2026-03-08 2:00 AM CST → CDT. 11:30 PM Mar 8 CDT = 04:30Z Mar 9
    expect(businessToday(new Date("2026-03-09T04:30:00Z"))).toBe("2026-03-08");
    // 2026-11-01 CDT → CST. 11:30 PM Nov 1 CST = 05:30Z Nov 2
    expect(businessToday(new Date("2026-11-02T05:30:00Z"))).toBe("2026-11-01");
  });

  it("does not depend on the server's own timezone", () => {
    const original = process.env.TZ;
    process.env.TZ = "Asia/Tokyo";
    try {
      expect(businessToday(new Date("2026-11-12T05:59:59Z"))).toBe("2026-11-11");
    } finally {
      process.env.TZ = original;
    }
  });

  it("validates real calendar dates", () => {
    expect(isValidDateString("2026-02-29")).toBe(false);
    expect(isValidDateString("2028-02-29")).toBe(true);
    expect(isValidDateString("12/12/2026")).toBe(false);
    expect(checkPublicEventDate("2031-01-01", NOON)).toMatch(/within the next 3 years/);
  });

  it("the inquiry schema rejects a past date with the exact message and makes it the headline error", () => {
    const r = inquirySchema(NOON).safeParse({ name: "A B", email: "a@b.co", eventDate: "2026-11-10", eventType: "Wedding" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const d = describeIssues(r.error.issues);
      expect(d.message).toBe(PAST_DATE_MESSAGE);
      expect(d.fieldErrors.eventDate).toBe(PAST_DATE_MESSAGE);
    }
  });

  it("date-only values are stored as midday Chicago so they never shift a day", () => {
    const stored = zonedTimeToUtc("2026-12-31", "12:00");
    expect(stored.toISOString()).toBe("2026-12-31T18:00:00.000Z");
    expect(utcToZonedDateStr(stored)).toBe("2026-12-31");
    // The old conversion (midnight UTC) showed as the previous day in Chicago:
    expect(utcToZonedDateStr(new Date("2026-12-31"))).toBe("2026-12-30");
  });
});
