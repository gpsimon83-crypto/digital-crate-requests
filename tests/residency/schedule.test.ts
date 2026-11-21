import { describe, it, expect } from "vitest";
import { datesToGenerate, fmtHours, gigStatus, gigsForFutureDj, monthSummary, nextGig, planScheduleChange, recurrenceLabel, scheduleDates, validateSchedule, type Gig, type Schedule } from "@/lib/residency";

const weekly: Schedule = { pattern: "weekly", weekday: 0, weeks: [], start_time: "12:00", end_time: "17:00", starts_on: "2026-11-01", ends_on: null };
const firstThirdSat: Schedule = { pattern: "monthly", weekday: 6, weeks: [1, 3], start_time: "21:00", end_time: "01:00", starts_on: "2026-11-01", ends_on: null };
const gig = (o: Partial<Gig>): Gig => ({ id: o.slot_date ?? "x", slot_date: "2026-11-22", gig_date: o.slot_date ?? "2026-11-22", start_time: "12:00", end_time: "17:00", dj_id: null, coverage: "unassigned", outcome: "scheduled", notes: null, source: "schedule", detached: false, off_schedule: false, ...o });

describe("schedules", () => {
  it("weekly: every Sunday", () => {
    expect(scheduleDates(weekly, "2026-11-20", "2026-12-14")).toEqual(["2026-11-22", "2026-11-29", "2026-12-06", "2026-12-13"]);
    expect(recurrenceLabel(weekly)).toBe("Weekly");
    expect(fmtHours("12:00", "17:00")).toBe("12–5 PM");
    expect(fmtHours("21:00", "01:00")).toBe("9 PM–1 AM");
  });
  it("first and third Saturday, and the last week of the month", () => {
    expect(scheduleDates(firstThirdSat, "2026-11-01", "2027-01-31")).toEqual(["2026-11-07", "2026-11-21", "2026-12-05", "2026-12-19", "2027-01-02", "2027-01-16"]);
    expect(recurrenceLabel(firstThirdSat)).toBe("1st & 3rd Saturday");
    expect(scheduleDates({ ...firstThirdSat, weeks: [5] }, "2026-11-01", "2027-01-31")).toEqual(["2026-11-28", "2026-12-26", "2027-01-30"]);
  });
  it("manual schedules generate nothing; start/end dates are respected", () => {
    expect(scheduleDates({ ...weekly, pattern: "manual" }, "2026-11-01", "2027-01-01")).toEqual([]);
    expect(scheduleDates({ ...weekly, starts_on: "2026-12-01", ends_on: "2026-12-20" }, "2026-11-01", "2027-01-01")).toEqual(["2026-12-06", "2026-12-13", "2026-12-20"]);
  });
  it("generating again creates nothing new, even after a gig moved to another day", () => {
    const first = datesToGenerate(weekly, [], "2026-11-20", 30);
    expect(first).toEqual(["2026-11-22", "2026-11-29", "2026-12-06", "2026-12-13", "2026-12-20"]);
    expect(datesToGenerate(weekly, first, "2026-11-20", 30)).toEqual([]);
    // the Nov 29 gig was moved to Nov 28: its slot is still Nov 29
    expect(datesToGenerate(weekly, first, "2026-11-20", 30)).not.toContain("2026-11-29");
  });
  it("validates input", () => {
    expect(validateSchedule({ ...firstThirdSat, weeks: [] })).toHaveProperty("error");
    expect(validateSchedule({ ...weekly, start_time: "12:00", end_time: "12:00" })).toHaveProperty("error");
    expect(validateSchedule({ ...weekly, ends_on: "2026-10-01" })).toHaveProperty("error");
    expect(validateSchedule(weekly)).toEqual({ value: weekly });
  });
});

describe("schedule edits (this and future)", () => {
  const gigs: Gig[] = [
    gig({ id: "past", slot_date: "2026-11-15", gig_date: "2026-11-15", outcome: "played", dj_id: "a", coverage: "confirmed" }),
    gig({ id: "n22", slot_date: "2026-11-22", gig_date: "2026-11-22" }),
    gig({ id: "n29", slot_date: "2026-11-29", gig_date: "2026-11-29", dj_id: "a", coverage: "confirmed" }),
    gig({ id: "d06", slot_date: "2026-12-06", gig_date: "2026-12-06", dj_id: "b", coverage: "awaiting", detached: true }),
    gig({ id: "d13", slot_date: "2026-12-13", gig_date: "2026-12-13", notes: "Holiday party" }),
    gig({ id: "man", slot_date: "2026-12-16", gig_date: "2026-12-16", source: "manual" })
  ];
  it("moving to Saturdays: past, edited and manual dates stay; empty dates go; dates with a DJ or notes are kept and flagged", () => {
    const plan = planScheduleChange({ ...weekly, weekday: 6 }, gigs, "2026-11-20");
    expect(plan.remove).toEqual(["n22"]);
    expect(plan.keepOff.sort()).toEqual(["d13", "n29"]);
    expect(plan.retime).toEqual([]);
  });
  it("new hours: confirmed DJs keep the date and get a note", () => {
    const plan = planScheduleChange({ ...weekly, start_time: "13:00", end_time: "18:00" }, gigs, "2026-11-20");
    expect(plan.retime.map((r) => r.id)).toEqual(["n22", "n29", "d13"]);
    expect(plan.retime.find((r) => r.id === "n29")?.change_note).toBe("Hours changed from 12–5 PM to 1–6 PM.");
    expect(plan.retime.find((r) => r.id === "n22")?.change_note).toBeNull();
  });
  it("a DJ for this and future skips one-night swaps and dates another DJ confirmed", () => {
    expect(gigsForFutureDj(gigs, "c", "2026-11-20").map((g) => g.id)).toEqual(["n22", "d13", "man"]);
  });
});

describe("status and money", () => {
  it("next gig skips canceled dates", () => {
    expect(nextGig([gig({ slot_date: "2026-11-22", outcome: "canceled" }), gig({ slot_date: "2026-11-29" })], "2026-11-20")?.gig_date).toBe("2026-11-29");
    expect(nextGig([gig({ slot_date: "2026-11-15" })], "2026-11-20")).toBeNull();
  });
  it("statuses: played awaiting its recap, canceled, coverage", () => {
    expect(gigStatus(gig({ outcome: "played", coverage: "confirmed" }), false, "2026-11-25").label).toBe("Recap due");
    expect(gigStatus(gig({ outcome: "played", coverage: "confirmed" }), true, "2026-11-25").label).toBe("Played");
    expect(gigStatus(gig({ outcome: "canceled" }), false, "2026-11-20").label).toBe("Canceled");
    expect(gigStatus(gig({ coverage: "awaiting", dj_id: "a" }), false, "2026-11-20").label).toBe("Awaiting confirmation");
  });
  it("month summary: outstanding venue payments and payouts per played gig", () => {
    const s = monthSummary(
      [
        { id: "1", outcome: "played", coverage: "confirmed", venue_fee_cents: 40000, dj_payout_cents: 25000, dj_id: "a" },
        { id: "2", outcome: "played", coverage: "confirmed", venue_fee_cents: 40000, dj_payout_cents: 25000, dj_id: "b" },
        { id: "3", outcome: "canceled", coverage: "unassigned", venue_fee_cents: 40000, dj_payout_cents: 25000, dj_id: null },
        { id: "4", outcome: "scheduled", coverage: "awaiting", venue_fee_cents: 40000, dj_payout_cents: 25000, dj_id: "a" }
      ],
      { "1": 40000 },
      { "1": { amount_cents: 25000, status: "paid" } }
    );
    expect(s).toMatchObject({ played: 2, canceled: 1, scheduled: 1, venueOutstandingCents: 40000, payoutOutstandingCents: 25000, payoutPaidCents: 25000, coverage: { confirmed: 2, awaiting: 1, unassigned: 0 } });
  });
});
