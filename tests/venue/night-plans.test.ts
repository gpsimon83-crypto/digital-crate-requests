import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { cleanPlanText, hasDjRequest, isEmptyPlan, parsePlanInput } from "@/lib/venue/night-plans";

describe("parsePlanInput", () => {
  const today = "2026-11-13";
  it("accepts a future date and cleans the text", () => {
    const r = parsePlanInput({ date: "2026-12-31", occasion: "  NYE  ", drink_specials: "$5 Old Fashioneds\n\n\n\n$3 taps\u0007", dj_request_id: "not-a-uuid", dj_request_name: "j.Prime" }, today);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.plan).toMatchObject({ date: "2026-12-31", occasion: "NYE", drink_specials: "$5 Old Fashioneds\n\n$3 taps", dj_request_id: null, dj_request_name: "j.Prime" });
  });
  it("rejects past, malformed, impossible and far-future dates", () => {
    expect(parsePlanInput({ date: "2026-11-12" }, today).ok).toBe(false);
    expect(parsePlanInput({ date: "12/31/2026" }, today).ok).toBe(false);
    expect(parsePlanInput({ date: "2026-02-30" }, today).ok).toBe(false);
    expect(parsePlanInput({ date: "2028-01-01" }, today).ok).toBe(false);
    expect(parsePlanInput({ date: today }, today).ok).toBe(true);
  });
  it("caps lengths and treats blank as empty", () => {
    expect(cleanPlanText("x".repeat(900), 600)).toHaveLength(600);
    expect(cleanPlanText("   ", 10)).toBeNull();
    expect(isEmptyPlan({ occasion: null, drink_specials: null, dj_request_id: null, dj_request_name: null, dj_request_note: null })).toBe(true);
    expect(hasDjRequest({ dj_request_id: null, dj_request_name: null, dj_request_note: "anyone who plays country" })).toBe(true);
  });
});

// ---- the save route ----
type Row = Record<string, unknown>;
const state: { rows: Row[]; notifications: Row[]; emails: unknown[]; preview: boolean; audits: string[] } = { rows: [], notifications: [], emails: [], preview: false, audits: [] };
function table(name: string) {
  const f: Record<string, unknown> = {};
  let op = "select";
  let payload: Row | Row[] | null = null;
  const q: Record<string, unknown> = {};
  const chain = (k: string) => (q[k] = (a?: unknown, b?: unknown) => { if (k === "eq") f[a as string] = b; return q; });
  ["select", "eq", "gte", "order", "limit"].forEach(chain);
  q.upsert = (p: Row) => ((op = "upsert"), (payload = p), q);
  q.insert = (p: Row[]) => { if (name === "notifications") state.notifications.push(...p); return Promise.resolve({ error: null }); };
  q.delete = () => ((op = "delete"), q);
  const match = (r: Row) => r.venue_id === f.venue_id && r.night_date === f.night_date;
  const run = () => {
    if (name === "djs") return { data: f.id === "11111111-1111-4111-8111-111111111111" ? { id: f.id, display_name: "DJ Que" } : null, error: null };
    if (op === "delete") { state.rows = state.rows.filter((r) => !match(r)); return { error: null }; }
    if (op === "upsert") {
      const p = payload as Row;
      state.rows = state.rows.filter((r) => !(r.venue_id === p.venue_id && r.night_date === p.night_date));
      state.rows.push(p);
      return { data: p, error: null };
    }
    return { data: state.rows.find(match) ?? null, error: null };
  };
  q.maybeSingle = () => Promise.resolve(run());
  q.single = () => Promise.resolve(run());
  q.then = (res: (v: unknown) => void) => res(run());
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => table(t),
    auth: { admin: { listUsers: async () => ({ data: { users: [{ id: "staff1", app_metadata: { role: "admin" } }, { id: "venue1", app_metadata: { role: "venue" } }] } }) } }
  })
}));
vi.mock("@/lib/roles", () => ({ accountRole: (u: { app_metadata?: { role?: string } }) => u.app_metadata?.role ?? null, isStaffRole: (r: string | null) => r === "admin" || r === "owner" || r === "manager" }));
vi.mock("@/lib/send-system-email", () => ({ sendSystemEmail: async (m: unknown) => { state.emails.push(m); return "id"; } }));
vi.mock("@/lib/venue/server", () => ({
  requireVenueAccess: async () => ({ preview: state.preview, user: { id: "u1", email: "mgr@venue.test" }, venues: [], venue: { id: "v1", name: "North 48", dcdjs_contact_email: "rep@dcdjs.test" } }),
  audit: async (_v: string, _u: unknown, action: string) => { state.audits.push(action); }
}));

const put = async (body: unknown) => {
  const { PUT } = await import("@/app/api/venue/night-plans/route");
  const res = await PUT(new NextRequest("https://www.cratesdjs.com/api/venue/night-plans", { method: "PUT", body: JSON.stringify(body) }));
  return { status: res.status, json: await res.json() };
};

describe("venue night plans route", () => {
  beforeEach(() => {
    Object.assign(state, { rows: [], notifications: [], emails: [], preview: false, audits: [] });
    vi.useFakeTimers({ now: new Date("2026-11-13T15:00:00Z"), toFake: ["Date"] });
  });

  it("is read-only in the staff preview", async () => {
    state.preview = true;
    const r = await put({ venue: "v1", date: "2026-11-21", drink_specials: "$5 shots" });
    expect(r.status).toBe(403);
    expect(state.rows).toHaveLength(0);
  });

  it("saves specials without notifying anyone", async () => {
    const r = await put({ venue: "v1", date: "2026-11-21", drink_specials: "$5 shots" });
    expect(r.status).toBe(200);
    expect(r.json.plan).toMatchObject({ date: "2026-11-21", drink_specials: "$5 shots", dj_requested_at: null });
    expect(state.notifications).toHaveLength(0);
    expect(state.emails).toHaveLength(0);
  });

  it("a DJ request notifies staff (not venue logins) once, and uses the DJ's real name", async () => {
    const body = { venue: "v1", date: "2026-12-31", occasion: "NYE", dj_request_id: "11111111-1111-4111-8111-111111111111", dj_request_name: "spoofed", dj_request_note: "big crowd" };
    const r = await put(body);
    expect(r.json.plan).toMatchObject({ dj_request_name: "DJ Que", occasion: "NYE" });
    expect(r.json.plan.dj_requested_at).toBeTruthy();
    expect(state.notifications.map((n) => n.user_id)).toEqual(["staff1"]);
    expect(String(state.notifications[0].title)).toContain("North 48 requested DJ Que");
    expect(String(state.notifications[0].body)).toContain("not a booking");
    expect(state.emails).toHaveLength(1);
    // Saving the same request again (e.g. only the specials changed) doesn't notify again.
    await put({ ...body, drink_specials: "$4 champagne" });
    expect(state.notifications).toHaveLength(1);
  });

  it("an unknown DJ id falls back to the typed name; past dates are refused; empty save removes", async () => {
    const r = await put({ venue: "v1", date: "2026-11-27", dj_request_id: "22222222-2222-4222-8222-222222222222", dj_request_name: "Rushie" });
    expect(r.json.plan).toMatchObject({ dj_request_id: null, dj_request_name: "Rushie" });
    expect((await put({ venue: "v1", date: "2026-11-01", drink_specials: "x" })).status).toBe(400);
    const cleared = await put({ venue: "v1", date: "2026-11-27" });
    expect(cleared.json.plan).toBeNull();
    expect(state.rows).toHaveLength(0);
    expect(state.audits).toContain("night_plan.cleared");
  });
});
