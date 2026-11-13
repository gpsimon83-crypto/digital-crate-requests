import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// A tiny stand-in for the Supabase query builder: records every filter and answers by table + filter.
const calls: { table: string; ops: string[] }[] = [];
function builder(table: string) {
  const ops: string[] = [];
  calls.push({ table, ops });
  const q: Record<string, unknown> = {};
  for (const m of ["select", "eq", "gte", "lt", "order", "limit", "neq", "is", "or", "not", "in"]) q[m] = (...a: unknown[]) => { ops.push(`${m}(${a.map(String).join(",")})`); return q; };
  q.then = (res: (v: unknown) => void) => res(answer(table, ops));
  q.maybeSingle = () => Promise.resolve(answer(table, ops));
  return q;
}
function answer(table: string, ops: string[]) {
  const named = ops.some((o) => o.startsWith("is(venue_id"));
  if (table === "venues") return { data: { locations: [{ name: "Cedarburg", calendar_names: ["North 48 Cedarburg"], is_default: true }, { name: "Oconomowoc", calendar_names: ["N48 Ocon"] }] }, error: null };
  if (table === "venue_djs") return { data: [], error: null };
  if (table === "venue_night_plans") return { data: [{ night_date: "2026-11-14", occasion: null, drink_specials: "$5 Old Fashioneds", dj_request_id: null, dj_request_name: null, dj_request_note: null, dj_requested_at: null, updated_at: "2026-11-12T00:00:00Z" }], error: null };
  if (table === "calendar_dj_names") return { data: [{ id: "m1", calendar_name: "Que", display_name: "DJ Que (actual)" }], error: null };
  if (table === "djs") return { data: [{ display_name: "DJ Que (actual)", photo_url: "https://cdn.example/que.png" }], error: null };
  if (table === "events" && !named) return { data: [{ id: "p1", event_category: "wedding", event_type: "Wedding", starts_at: "2026-11-21T23:00:00Z", ends_at: null, status: "confirmed", dj_id: null, djs: null }], error: null };
  if (table === "events" && named) return { data: [{ id: "p2", event_category: "private", event_type: "Birthday", starts_at: "2026-11-22T01:00:00Z", ends_at: null, status: "pending_confirmation", dj_id: null, djs: { display_name: "DJ Que", photo_url: null } }], error: null };
  if (table === "external_calendar_busy_blocks") return { data: [
    { google_event_id: "ev2", summary: "Saturday Night – North 48 – Private client stuff", starts_at: "2026-11-15T03:00:00Z", ends_at: "2026-11-15T08:00:00Z" },
    { google_event_id: "ev9", summary: "North 48 – 6pm show", starts_at: "2026-11-28T00:00:00Z", ends_at: "2026-11-28T05:00:00Z" },
    { google_event_id: "ev10", summary: "North 48 closed", starts_at: "2026-11-26T00:00:00Z", ends_at: "2026-11-27T00:00:00Z" }
  ], error: null };
  return { data: [], error: null };
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => builder(t) }) }));
vi.mock("@/lib/venue/server", () => ({
  requireVenueAccess: async () => ({
    preview: false, venues: [],
    venue: { id: "v1", name: "North 48", calendar_names: ["N48", "Bad,name(x)"], recurring_nights: [{ day: 6, label: "Saturday Night Party", start: "21:00", end: "01:00" }], dcdjs_contact_name: null, dcdjs_contact_email: null, dcdjs_contact_phone: null }
  })
}));
const createHash = (await import("crypto")).createHash;
const feedId = (g: string) => `gcal_${createHash("sha256").update(g).digest("hex").slice(0, 20)}`;
vi.mock("@/lib/venue/calendar-feed", () => ({
  fetchVenueNights: async () => ({ status: "ok", nights: [{ id: feedId("ev2"), date: "2026-11-14", starts_at: "2026-11-14T21:00:00-06:00", ends_at: "2026-11-15T02:00:00-06:00", all_day: false, matched: "North 48", state: "confirmed", dj_text: "Que", dj: { name: "DJ Que", photo_url: null } }] })
}));

describe("venue dashboard pulls cratesdjs.com calendar data for the venue", () => {
  it("adds name-matched projects and pulled Google events, de-duplicated, without titles", async () => {
    vi.useFakeTimers({ now: new Date("2026-11-12T18:00:00Z"), toFake: ["Date"] });
    const { GET } = await import("@/app/api/venue/dashboard/route");
    const res = await GET(new NextRequest("https://www.cratesdjs.com/api/venue/dashboard?month=2026-11"));
    const body = await res.json();
    vi.useRealTimers();
    const m = body.monthEvents as { id: string; date: string; label: string; status: string; starts_at: string | null; dj: { name: string } | null }[];
    // Linked project, name-matched project, the calendar night (once, with its DJ), the 6 PM show, the all-day closure.
    expect(m.map((e) => e.id).sort()).toEqual([feedId("ev10"), feedId("ev2"), feedId("ev9"), "p1", "p2"].sort());
    const n14 = m.find((e) => e.id === feedId("ev2"))! as typeof m[number] & { location_id: string | null };
    expect(n14).toMatchObject({ date: "2026-11-14", status: "confirmed", label: "Saturday Night Party", dj: { name: "DJ Que (actual)", photo_url: "https://cdn.example/que.png" } });
    const six = m.find((e) => e.id === feedId("ev9"))!;
    expect(six.date).toBe("2026-11-27");
    expect(six.starts_at).not.toBeNull();
    // The booking's event type is shown (the venue asked for it); client details never are.
    expect(m.find((e) => e.id === "p2")!.label).toBe("Birthday");
    const closed = m.find((e) => e.id === feedId("ev10"))!;
    expect(closed).toMatchObject({ date: "2026-11-26", starts_at: null });
    expect(JSON.stringify(body)).not.toMatch(/Private client stuff|closed|6pm show|N48/);
    // Locations: nights that only say "North 48" go to the default location; browsers never get calendar names.
    expect(n14.location_id).toBe("loc_cedarburg");
    expect(body.venue.locations).toEqual([{ id: "loc_cedarburg", name: "Cedarburg", city: null, is_default: true }, { id: "loc_oconomowoc", name: "Oconomowoc", city: null, is_default: false }]);
    expect(JSON.stringify(body)).not.toContain("N48 Ocon");
    // The venue's night plans come along; the venue can edit them (not a preview).
    expect(body.plans).toEqual([expect.objectContaining({ date: "2026-11-14", drink_specials: "$5 Old Fashioneds" })]);
    expect(body.planning).toEqual({ ready: true, canEdit: true });
    expect(calls.find((c) => c.table === "venue_night_plans")!.ops).toContain("eq(venue_id,v1)");
    // Search terms are the venue name plus calendar names, with filter characters removed.
    const ors = calls.flatMap((c) => c.ops.filter((o) => o.startsWith("or(")));
    expect(ors.join(" ")).toContain("venue_name.ilike.*North 48*");
    expect(ors.join(" ")).toContain("summary.ilike.*Bad name x*");
    expect(ors.join(" ")).not.toMatch(/Bad,name|\(x\)/);
    // Name-matched projects skip unconfirmed inquiries and declined ones.
    expect(calls.filter((c) => c.ops.some((o) => o.startsWith("is(venue_id"))).every((c) => c.ops.includes("not(status,in,(inquiry,declined))"))).toBe(true);
  });
});
