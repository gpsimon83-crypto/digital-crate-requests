import { describe, it, expect } from "vitest";
import { calendarItems, djActionGroups, djActivity, djMetrics, payoutTrend, type DjPayout } from "@/lib/dj/overview";
import { DJ_LINKS } from "@/lib/dj/links";
import { djShellHidden } from "@/lib/dj-nav";
import type { DashEvent } from "@/lib/dashboard/overview";
import type { MyGig } from "@/lib/data/my-gigs";

const NOW = new Date(2026, 10, 21, 13, 0);
const at = (d: number, h = 19) => new Date(2026, 10, d, h).toISOString();
let n = 0;
const ev = (o: Partial<DashEvent>): DashEvent => ({
  id: `11111111-2222-4333-8444-${String(++n).padStart(12, "0")}`,
  title: `Gig ${n}`,
  status: "confirmed",
  event_type: null,
  event_category: null,
  starts_at: at(25),
  created_at: "2026-11-01T12:00:00Z",
  quoted_amount: null,
  final_amount: null,
  paid_cents: 0,
  contract_status: "none",
  djs: { display_name: "DJ Penny", photo_url: null },
  venues: null,
  clients: null,
  ...o
});
const gig = (o: Partial<MyGig>): MyGig => ({ key: `k${++n}`, source: "google", title: "Peace @ Kyotes", venue: null, date: "2026-11-24", starts_at: at(24, 21), ends_at: null, status: null, href: null, ...o });

describe("DJ dashboard numbers", () => {
  const events = [ev({ status: "pending_confirmation", starts_at: at(28) }), ev({ status: "inquiry", starts_at: at(30) }), ev({ starts_at: at(23) })];
  const payouts: DjPayout[] = [
    { id: "a", amount_cents: 30000, status: "pending", paid_at: null, created_at: "2026-11-10T12:00:00Z", events: { title: "Gig A", starts_at: null } },
    { id: "b", amount_cents: 45000, status: "paid", paid_at: "2026-10-05T12:00:00Z", created_at: "2026-09-30T12:00:00Z", events: { title: "Gig B", starts_at: null } },
    { id: "c", amount_cents: 9900, status: "paid", paid_at: "2025-12-05T12:00:00Z", created_at: "2025-12-01T12:00:00Z", events: null }
  ];

  it("counts gigs ahead (not leads), leads, and pay owed vs paid", () => {
    const gigs = [gig({ starts_at: at(23) }), gig({ starts_at: at(27) }), gig({ starts_at: new Date(2026, 11, 15).toISOString() }), gig({ status: "inquiry", starts_at: at(24) }), gig({ starts_at: at(10) })];
    const m = djMetrics(gigs, events, payouts, NOW);
    expect(m.thisWeek).toBe(2);
    expect(m.next30).toBe(3);
    expect(m.openLeads).toBe(1);
    expect(m.pendingCents).toBe(30000);
    expect(m.paidThisYearCents).toBe(45000);
  });

  it("action list: only what needs doing, with where to do it", () => {
    const g = djActionGroups(events, { awaiting: [{}, {}], upcoming: [], recapDue: [{}] }, [{ id: "t", event_id: "e9", title: "Send playlist", due_date: "2026-11-23" }], NOW);
    expect(g.map((x) => [x.title, x.count, x.href])).toEqual([
      ["Confirm bookings", 1, "/dj-dashboard/bookings"],
      ["Confirm recurring gigs", 2, "/dj-dashboard/gigs"],
      ["Send gig recaps", 1, "/dj-dashboard/gigs"],
      ["Finish tasks", 1, "/dj-dashboard/projects/e9"],
      ["Follow up on leads", 1, "/dj-dashboard/leads"]
    ]);
    expect(djActionGroups([ev({})], { awaiting: [], upcoming: [], recapDue: [] }, [], NOW)).toEqual([]);
  });

  it("earnings: pending by month added, paid by month paid", () => {
    expect(payoutTrend(payouts)).toEqual([
      { month: "2025-12", bookedCents: 0, collectedCents: 9900 },
      { month: "2026-10", bookedCents: 0, collectedCents: 45000 },
      { month: "2026-11", bookedCents: 30000, collectedCents: 0 }
    ]);
  });

  it("calendar: Google Calendar entries join the bookings and open the calendar page", () => {
    const items = calendarItems([gig({ key: "gabc", venue: "Kyotes" }), gig({ source: "project", key: "p:x" })], [events[2]]);
    expect(items).toHaveLength(2);
    expect(items[1].title).toBe("Peace @ Kyotes · Kyotes");
    expect(DJ_LINKS.project(items[1].id)).toBe("/dj-dashboard/calendar");
    expect(DJ_LINKS.project(events[2].id)).toBe(`/dj-dashboard/projects/${events[2].id}`);
  });

  it("activity links to the DJ's own pages", () => {
    const a = djActivity(events, payouts);
    expect(a.every((x) => x.href.startsWith("/dj-dashboard/"))).toBe(true);
    expect(a.find((x) => x.kind === "payment")).toMatchObject({ title: "Payout paid", amountCents: 45000 });
  });

  it("menu stays off sign-in pages and the flyer editor only", () => {
    expect(djShellHidden("/dj-dashboard/login")).toBe(true);
    expect(djShellHidden("/dj-dashboard/signup")).toBe(true);
    expect(djShellHidden("/dj-dashboard/flyers/abc-123")).toBe(true);
    expect(djShellHidden("/dj-dashboard/flyers")).toBe(false);
    expect(djShellHidden("/dj-dashboard/flyers/library")).toBe(false);
    expect(djShellHidden("/dj-dashboard/leads")).toBe(false);
  });
});
