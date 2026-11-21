import { describe, it, expect } from "vitest";
import {
  actionGroups,
  eventsByDay,
  fillTrend,
  matchesNeed,
  metrics,
  monthGrid,
  monthsOf,
  recentActivity,
  relativeTime,
  typeBreakdown,
  upcomingEvents,
  type DashEvent,
  type DashPayment
} from "@/lib/dashboard/overview";

const NOW = new Date(2026, 10, 21, 13, 0); // Sat Nov 21 2026, 1pm local
let n = 0;
const ev = (o: Partial<DashEvent>): DashEvent => ({
  id: `e${++n}`,
  title: `Event ${n}`,
  status: "confirmed",
  event_type: null,
  event_category: null,
  starts_at: null,
  created_at: "2026-10-01T12:00:00Z",
  quoted_amount: null,
  final_amount: null,
  paid_cents: 0,
  contract_status: "none",
  wedding_music_plan_sent_at: null,
  djs: null,
  venues: null,
  clients: null,
  ...o
});
const at = (d: number, h = 19, m = 10) => new Date(2026, m, d, h).toISOString();
const dj = { display_name: "DJ A", photo_url: null };

describe("dashboard numbers", () => {
  const events = [
    ev({ status: "inquiry", starts_at: at(25), quoted_amount: 900 }), // inquiry, no DJ
    ev({ status: "confirmed", starts_at: at(24), final_amount: 1500, paid_cents: 50000, djs: dj, contract_status: "signed" }), // this week, $1,000 due
    ev({ status: "confirmed", starts_at: at(12, 19, 11), quoted_amount: 2000, contract_status: "sent" }), // Dec 12, no DJ, contract out
    ev({ status: "declined", starts_at: at(23), quoted_amount: 5000 }), // never counted
    ev({ status: "ended", starts_at: at(1, 19, 2), final_amount: 450, paid_cents: 45000, djs: dj, event_category: "wedding" }), // March, paid, wedding
    ev({ status: "confirmed", starts_at: at(15, 19, 0), final_amount: 700, djs: dj }) // last year Jan 15 2026? (month 0) still this year
  ];
  const payments: DashPayment[] = [
    { id: "p1", amount_cents: 50000, paid_at: "2026-11-02T15:00:00Z", events: { title: "Event 2" } },
    { id: "p2", amount_cents: 45000, paid_at: "2026-02-20T15:00:00Z", events: [{ title: "Event 5" }] },
    { id: "p3", amount_cents: 10000, paid_at: "2025-12-20T15:00:00Z", events: null }
  ];

  it("upcoming: from now on, declined left out, inquiries kept, soonest first", () => {
    const u = upcomingEvents(events, NOW);
    expect(u.map((e) => e.status)).toEqual(["confirmed", "inquiry", "confirmed"]);
    expect(u.find((e) => e.status === "declined")).toBeUndefined();
  });

  it("metrics keep booked, collected and owed apart", () => {
    const m = metrics(events, payments, NOW);
    expect(m.newLeads).toBe(1);
    expect(m.pendingContracts).toBe(1);
    expect(m.upcomingThisWeek).toBe(2); // Nov 24 confirmed + Nov 25 inquiry
    // Booked: confirmed/live/ended dated 2026 = 1500 + 2000 + 450 + 700 (inquiry and declined out)
    expect(m.bookedThisYearCents).toBe(465000);
    // Collected: payments received in 2026 only
    expect(m.collectedThisYearCents).toBe(95000);
    // Owed: booked events with a balance = 1000 + 2000 + 700
    expect(m.outstandingCents).toBe(370000);
  });

  it("action groups: counts per workflow, no grand total, empty groups hidden", () => {
    const g = actionGroups(events, NOW);
    const by = Object.fromEntries(g.map((x) => [x.key, x]));
    expect(by.dj.count).toBe(2); // inquiry + Dec 12 confirmed (both upcoming, no DJ)
    expect(by.dj.detail).toMatch(/1 still an inquiry/);
    expect(by.inquiries.count).toBe(1);
    expect(by.contract.count).toBe(1);
    expect(by.balance.count).toBe(3);
    expect(by.balance.amountCents).toBe(370000);
    expect(by.music.count).toBe(1);
    expect(g.every((x) => x.count > 0)).toBe(true);
    expect(actionGroups([ev({ status: "confirmed", djs: dj })], NOW)).toEqual([]);
    // Each group opens the Projects list with the same rule.
    expect(events.filter((e) => matchesNeed(e, "dj", NOW))).toHaveLength(by.dj.count);
    expect(by.dj.href).toBe("/admin/events?need=dj");
  });

  it("revenue months are complete and in order; gaps are real zeros", () => {
    const t = fillTrend("last_6_months", NOW, [
      { month: "2026-10", bookedCents: 45000, collectedCents: 0 },
      { month: "2026-07", bookedCents: 0, collectedCents: 1000 }
    ]);
    expect(t.map((r) => r.month)).toEqual(["2026-06", "2026-07", "2026-08", "2026-09", "2026-10", "2026-11"]);
    expect(t[5]).toEqual({ month: "2026-11", bookedCents: 0, collectedCents: 0 });
    expect(monthsOf("last_year", NOW, [])).toHaveLength(12);
    expect(monthsOf("this_year", NOW, [])).toHaveLength(11);
    expect(monthsOf("all_time", NOW, [])).toEqual([]);
    expect(monthsOf("all_time", NOW, ["2025-11", "2026-01"])[0]).toBe("2025-11");
    expect(monthsOf("last_12_months", new Date(2026, 1, 3), [])[0]).toBe("2025-03");
  });

  it("event types: one category = one full bar, empty ones dropped", () => {
    expect(typeBreakdown([{ type: "Club / Bar Night", count: 1, revenueCents: 45000 }, { type: "Wedding", count: 2, revenueCents: 0 }])).toEqual({
      total: 45000,
      rows: [{ type: "Club / Bar Night", count: 1, revenueCents: 45000, share: 1 }]
    });
    const b = typeBreakdown([{ type: "A", count: 1, revenueCents: 100 }, { type: "B", count: 1, revenueCents: 300 }]);
    expect(b.rows.map((r) => [r.type, r.share])).toEqual([["B", 0.75], ["A", 0.25]]);
  });

  it("calendar: Sunday-first grid that fits the month; events by local day", () => {
    const g = monthGrid(new Date(2026, 10, 1)); // Nov 2026 starts on a Sunday, 30 days
    expect(g[0].getDay()).toBe(0);
    expect(g[0].getDate()).toBe(1);
    expect(g).toHaveLength(35);
    const feb = monthGrid(new Date(2026, 1, 1)); // Feb 2026 starts Sunday, 28 days → 4 weeks
    expect(feb).toHaveLength(28);
    const aug = monthGrid(new Date(2026, 7, 1)); // Aug 2026 starts Saturday → 6 weeks
    expect(aug).toHaveLength(42);
    expect(aug[6].getDate()).toBe(1);
    const days = eventsByDay(events);
    expect(days.get("2026-11-24")).toHaveLength(1);
    expect(days.get("2026-11-23")).toBeUndefined(); // declined
  });

  it("activity: newest first, plain text, links to the record", () => {
    const a = recentActivity(events, payments, 4);
    expect(a).toHaveLength(4);
    expect(a[0]).toMatchObject({ kind: "payment", detail: "Event 2", href: "/admin/finance", amountCents: 50000 });
    expect(a.find((x) => x.kind === "lead")?.href).toMatch(/^\/admin\/events\/e/);
    expect(relativeTime(new Date(NOW.getTime() - 5 * 60000).toISOString(), NOW)).toBe("5m ago");
    expect(relativeTime(new Date(NOW.getTime() - 3 * 3600000).toISOString(), NOW)).toBe("3h ago");
  });
});
