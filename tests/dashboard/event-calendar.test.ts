import { describe, expect, it } from "vitest";
import { dayKey, monthGrid, type DashEvent } from "@/lib/dashboard/overview";
import { addDaysKey, addMonthsKey, calKind, keyMove, monthAgenda, sameDayIn, timeRange } from "@/lib/dashboard/calendar";

const ev = (id: string, starts_at: string, status = "confirmed", extra: Partial<DashEvent> = {}): DashEvent =>
  ({ id, title: id, status, event_type: null, event_category: null, starts_at, created_at: starts_at, quoted_amount: null, final_amount: null, paid_cents: 0, contract_status: "none", djs: null, venues: null, clients: null, ...extra }) as DashEvent;

describe("month grid", () => {
  it("has the right weeks, starts on Sunday and covers every day", () => {
    const cases: [number, number, number, number][] = [
      // year, month (0-based), days in month, weeks
      [2026, 1, 28, 4], // Feb 2026 starts on a Sunday: exactly 4 weeks
      [2028, 1, 29, 5], // leap year
      [2024, 1, 29, 5],
      [2026, 7, 31, 6], // Aug 2026 starts on a Saturday: 6 weeks
      [2026, 10, 30, 5] // Nov 2026
    ];
    for (const [y, m, days, weeks] of cases) {
      const g = monthGrid(new Date(y, m, 1));
      expect(g.length, `${y}-${m + 1}`).toBe(weeks * 7);
      expect(g[0].getDay()).toBe(0);
      const inMonth = g.filter((d) => d.getMonth() === m);
      expect(inMonth.length).toBe(days);
      expect(inMonth[0].getDay()).toBe(new Date(y, m, 1).getDay());
      expect(g.indexOf(inMonth[0])).toBe(new Date(y, m, 1).getDay());
    }
  });
  it("puts Nov 1 2026 on Sunday and Dec 4 2026 on Friday", () => {
    const g = monthGrid(new Date(2026, 10, 1));
    expect(dayKey(g[0])).toBe("2026-11-01");
    expect(g.map(dayKey)).toContain("2026-12-04");
    expect(g.find((d) => dayKey(d) === "2026-12-04")!.getDay()).toBe(5);
  });
});

describe("moving between days", () => {
  it("crosses months, years and daylight-saving changes by calendar day", () => {
    expect(addDaysKey("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysKey("2026-03-07", 1)).toBe("2026-03-08");
    expect(addDaysKey("2026-03-08", 1)).toBe("2026-03-09");
    expect(addDaysKey("2026-11-01", -1)).toBe("2026-10-31");
    expect(addDaysKey("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("arrow keys, Home/End and Page keys", () => {
    expect(keyMove("2026-11-22", "ArrowDown")).toBe("2026-11-29");
    expect(keyMove("2026-11-29", "ArrowDown")).toBe("2026-12-06");
    expect(keyMove("2026-11-25", "Home")).toBe("2026-11-22");
    expect(keyMove("2026-11-25", "End")).toBe("2026-11-28");
    expect(keyMove("2026-11-22", "PageDown")).toBe("2026-12-22");
    expect(keyMove("2026-11-22", "Enter")).toBeNull();
  });
  it("keeps the day number when changing months, clamped to the month's length", () => {
    expect(addMonthsKey("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonthsKey("2028-01-31", 1)).toBe("2028-02-29");
    expect(sameDayIn(new Date(2026, 3, 1), "2026-03-31")).toBe("2026-04-30");
  });
});

describe("events", () => {
  it("sorts kinds into booked, inquiry and away", () => {
    expect(["confirmed", "pending_confirmation", "live", "ended"].map(calKind)).toEqual(["booked", "booked", "booked", "booked"]);
    expect(calKind("inquiry")).toBe("inquiry");
    expect(calKind("away")).toBe("away");
  });
  it("agenda lists only the displayed month, earliest first, and leaves out declined", () => {
    const list = monthAgenda(
      [
        ev("b", new Date(2026, 11, 4, 18).toISOString()),
        ev("a", new Date(2026, 11, 4, 9).toISOString()),
        ev("x", new Date(2026, 11, 2, 9).toISOString(), "declined"),
        ev("n", new Date(2026, 10, 28, 19).toISOString()),
        ev("c", new Date(2026, 11, 1, 20).toISOString(), "inquiry")
      ],
      new Date(2026, 11, 1)
    );
    expect(list.map((d) => d.key)).toEqual(["2026-12-01", "2026-12-04"]);
    expect(list[1].events.map((e) => e.id)).toEqual(["a", "b"]);
  });
  it("shows only the times an event has", () => {
    const s = new Date(2026, 11, 4, 18).toISOString();
    expect(timeRange({ starts_at: s, all_day: true })).toBe("All day");
    expect(timeRange({ starts_at: s })).toMatch(/6:00/);
    expect(timeRange({ starts_at: s, ends_at: new Date(2026, 11, 4, 23).toISOString() })).toMatch(/6:00.*–.*11:00/);
    expect(timeRange({ starts_at: s, ends_at: new Date(2026, 11, 5, 1).toISOString() })).toMatch(/Dec 5/);
    expect(timeRange({ starts_at: s, ends_at: s })).not.toMatch(/–/);
  });
});
