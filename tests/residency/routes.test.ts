import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";

/* ---------- in-memory Supabase ---------- */
type Row = Record<string, unknown>;
let db: Record<string, Row[]> = {};
const UNIQUE: Record<string, string[][]> = { residencies: [["event_id"]], residency_gigs: [["residency_id", "slot_date"]], residency_recaps: [["gig_id"]] };
const dup = (t: string, r: Row) => (UNIQUE[t] ?? []).some((cols) => (db[t] ?? []).some((x) => cols.every((c) => x[c] === r[c])));
function embedRow(table: string, r: Row, cols: string): Row {
  const out = { ...r };
  if (table === "residency_gigs" && cols.includes("residencies(")) {
    const res = db.residencies.find((x) => x.id === r.residency_id) ?? null;
    out.residencies = res ? { ...res, venues: db.venues.find((v) => v.id === res.venue_id) ?? null } : null;
  }
  if (table === "residency_recaps" && cols.includes("residencies(")) out.residencies = db.residencies.find((x) => x.id === r.residency_id) ?? null;
  return out;
}
function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let cols = "*";
  let op = "select";
  let payload: Row | Row[] = {};
  let opts: { ignoreDuplicates?: boolean } = {};
  let lim = Infinity;
  const run = (mode: "many" | "single" | "maybe") => {
    const rows = (db[table] ??= []);
    if (op === "insert" || op === "upsert") {
      const list = (Array.isArray(payload) ? payload : [payload]).map((p) => ({ id: randomUUID(), created_at: new Date().toISOString(), ...defaults(table), ...p }));
      const added: Row[] = [];
      for (const r of list) {
        if (dup(table, r)) {
          if (op === "upsert" && opts.ignoreDuplicates) continue;
          return { data: null, error: { code: "23505", message: "duplicate" } };
        }
        rows.push(r);
        added.push(r);
      }
      return { data: mode === "many" ? added : (added[0] ?? null), error: null };
    }
    const hit = rows.filter((r) => filters.every((f) => f(r)));
    if (op === "update") {
      hit.forEach((r) => Object.assign(r, payload));
      return { data: mode === "many" ? hit : (hit[0] ?? null), error: null };
    }
    if (op === "delete") {
      db[table] = rows.filter((r) => !hit.includes(r));
      return { data: null, error: null };
    }
    const out = hit.slice(0, lim).map((r) => embedRow(table, r, cols));
    if (mode === "single") return out.length === 1 ? { data: out[0], error: null } : { data: null, error: { message: "not single" } };
    if (mode === "maybe") return { data: out[0] ?? null, error: null };
    return { data: out, error: null };
  };
  const q: Record<string, unknown> = {
    select: (c?: string) => ((cols = c ?? "*"), q),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
    gte: (k: string, v: string) => (filters.push((r) => String(r[k]) >= v), q),
    order: (k: string, o?: { ascending?: boolean }) => {
      const asc = o?.ascending !== false;
      const prev = run;
      void prev;
      sorters.push((a: Row, b: Row) => (asc ? 1 : -1) * String(a[k]).localeCompare(String(b[k])));
      return q;
    },
    limit: (n: number) => ((lim = n), q),
    insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), q),
    upsert: (p: Row[], o: { ignoreDuplicates?: boolean }) => ((op = "upsert"), (payload = p), (opts = o ?? {}), q),
    update: (p: Row) => ((op = "update"), (payload = p), q),
    delete: () => ((op = "delete"), q),
    maybeSingle: () => Promise.resolve(sorted(run("maybe"))),
    single: () => Promise.resolve(sorted(run("single"))),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(sorted(run("many"))).then(res, rej)
  };
  const sorters: ((a: Row, b: Row) => number)[] = [];
  const sorted = (r: { data: unknown; error: unknown }) => {
    if (Array.isArray(r.data) && sorters.length) r.data = [...(r.data as Row[])].sort((a, b) => sorters.reduce((n, s) => n || s(a, b), 0));
    return r;
  };
  return q;
}
function defaults(t: string): Row {
  if (t === "residency_gigs") return { coverage: "unassigned", outcome: "scheduled", notes: null, source: "schedule", detached: false, off_schedule: false, change_note: null, cancel_reason: null, venue_fee_cents: null, dj_payout_cents: null, dj_id: null };
  if (t === "residencies") return { pattern: "weekly", weeks: [], active: true, timezone: "America/Chicago", default_dj_id: null, venue_fee_cents: null, dj_payout_cents: null, money_notes: null, ends_on: null };
  return {};
}

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => query(t) }) }));
let me: { id: string; role: string } = { id: "staff1", role: "admin" };
let perms = new Set(["finance.view_company", "finance.manage"]);
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: me.id, app_metadata: { role: me.role } } } }) } }) }));
vi.mock("@/lib/roles", () => ({ accountRole: (u: { app_metadata: { role: string } }) => u.app_metadata.role, isStaffRole: (r: string) => r === "admin" || r === "manager" }));
vi.mock("@/lib/data/permissions", () => ({ resolveUserRole: async (_: string, r: string) => r, hasPermission: async (_: string, c: string) => perms.has(c) }));
vi.mock("@/lib/comm/server", () => ({ requireStaffUser: async () => (me.role === "dj" ? NextResponse.json({ error: "Admin access required" }, { status: 403 }) : { userId: me.id, email: null }) }));
vi.mock("@/lib/require-permission", () => ({ requirePermission: async (c: string) => (perms.has(c) ? null : NextResponse.json({ error: "no" }, { status: 403 })) }));
vi.mock("@/lib/notify-submission", () => ({ notifyStaff: async () => {} }));
vi.mock("@/lib/activity", () => ({ logActivity: async () => {} }));

import * as res from "@/app/api/admin/events/[id]/residency/route";
import * as gigsRoute from "@/app/api/admin/events/[id]/residency/gigs/route";
import * as gigRoute from "@/app/api/admin/events/[id]/residency/gigs/[gigId]/route";
import * as fin from "@/app/api/admin/events/[id]/residency/financials/route";
import * as djGig from "@/app/api/dj/gigs/[gigId]/route";
import { addDays, todayIn, weekdayOf } from "@/lib/residency";

const EV = "ev1";
const today = todayIn("America/Chicago");
const req = (method: string, body?: unknown, url = "http://x/api") => new NextRequest(url, { method, body: body ? JSON.stringify(body) : undefined });
const P = { params: Promise.resolve({ id: EV }) };
const G = (gigId: string) => ({ params: Promise.resolve({ id: EV, gigId }) });
const gigs = () => (db.residency_gigs ?? []).sort((a, b) => String(a.gig_date).localeCompare(String(b.gig_date)));
const view = async () => (await (await res.GET(req("GET"), P)).json()) as { gigs: Row[]; residency: Row; nextGigId: string };
const patchGig = (id: string, body: Row) => gigRoute.PATCH(req("PATCH", body), G(id));
const asStaff = () => (me = { id: "staff1", role: "admin" });
const asDj = (id: string) => (me = { id, role: "dj" });
const sunday = addDays(today, (7 - weekdayOf(today)) % 7 || 7); // next Sunday after today

beforeEach(() => {
  asStaff();
  perms = new Set(["finance.view_company", "finance.manage"]);
  db = {
    events: [{ id: EV, event_category: "bar_nightclub", venue_id: "v1", timezone: "America/Chicago" }],
    venues: [{ id: "v1", name: "Kyotes Bar N Grill", city: "Belgium", state: "WI", dj_brief: { load_in: "Main entrance" }, scheduling_prefs: {} }],
    djs: [
      { id: "jprime", display_name: "DJ JPrime", auth_user_id: "u-jprime" },
      { id: "penny", display_name: "DJ Penny", auth_user_id: "u-penny" }
    ],
    venue_djs: [],
    residencies: [],
    residency_gigs: [],
    residency_recaps: [],
    venue_brief_pins: [],
    payments: [],
    payouts: [],
    notifications: [],
    tasks: [],
    venue_audit_log: []
  };
});

const weekly = { name: "Sunday Funday", pattern: "weekly", weekday: 0, start_time: "12:00", end_time: "17:00", starts_on: today, venueFee: "400", djPayout: "250" };

describe("recurring bookings", () => {
  it("weekly residency: Sundays four months ahead, and no duplicates when generated again", async () => {
    expect((await res.POST(req("POST", weekly), P)).status).toBe(200);
    const n = gigs().length;
    expect(n).toBeGreaterThanOrEqual(17);
    expect(gigs().every((g) => weekdayOf(String(g.gig_date)) === 0 && g.start_time === "12:00")).toBe(true);
    await view();
    await Promise.all([view(), view()]);
    expect(gigs().length).toBe(n);
    expect(new Set(gigs().map((g) => g.slot_date)).size).toBe(n);
    expect((await res.POST(req("POST", weekly), P)).status).toBe(409);
  });

  it("first-and-third-Saturday residency", async () => {
    await res.POST(req("POST", { ...weekly, name: "Saturday Night", pattern: "monthly", weekday: 6, weeks: [1, 3], start_time: "21:00", end_time: "01:00" }), P);
    for (const g of gigs()) {
      const d = Number(String(g.gig_date).slice(8));
      expect(weekdayOf(String(g.gig_date))).toBe(6);
      expect((d >= 1 && d <= 7) || (d >= 15 && d <= 21)).toBe(true);
    }
    expect(gigs().length).toBeGreaterThanOrEqual(7);
  });

  it("only Bar / Club projects can be recurring", async () => {
    db.events[0].event_category = "wedding";
    expect((await res.POST(req("POST", weekly), P)).status).toBe(400);
  });

  it("one-night DJ swap stays when the usual DJ is set for this and future gigs", async () => {
    await res.POST(req("POST", weekly), P);
    const [a, b, c] = gigs();
    await patchGig(String(b.id), { action: "assign", djId: "penny", scope: "one" });
    expect(b).toMatchObject({ dj_id: "penny", coverage: "awaiting", detached: true });
    await patchGig(String(a.id), { action: "assign", djId: "jprime", scope: "future" });
    expect(a).toMatchObject({ dj_id: "jprime", coverage: "awaiting" });
    expect(c).toMatchObject({ dj_id: "jprime" });
    expect(b.dj_id).toBe("penny");
    expect(db.residencies[0].default_dj_id).toBe("jprime");
    // new dates generated later go to the usual DJ
    const last = gigs().at(-1)!;
    db.residency_gigs = db.residency_gigs.filter((g) => g !== last);
    await view();
    expect(gigs().at(-1)).toMatchObject({ dj_id: "jprime", coverage: "awaiting" });
  });

  it("a canceled date stays canceled, isn't generated again, and isn't the next gig", async () => {
    await res.POST(req("POST", weekly), P);
    const first = gigs()[0]!;
    expect((await patchGig(String(first.id), { action: "cancel", reason: "" })).status).toBe(400);
    await patchGig(String(first.id), { action: "cancel", reason: "Private party" });
    const v = await view();
    expect(first).toMatchObject({ outcome: "canceled", cancel_reason: "Private party" });
    expect(gigs().filter((g) => g.slot_date === first.slot_date).length).toBe(1);
    expect(v.nextGigId).toBe(gigs()[1].id);
  });

  it("schedule edits keep past gigs, edited dates and confirmed DJs", async () => {
    await res.POST(req("POST", weekly), P);
    db.residency_gigs.push({ id: "past", residency_id: db.residencies[0].id, event_id: EV, slot_date: addDays(sunday, -14), gig_date: addDays(sunday, -14), start_time: "12:00", end_time: "17:00", dj_id: "jprime", coverage: "confirmed", outcome: "played", source: "schedule", detached: false, off_schedule: false, notes: null });
    const [n1, n2] = gigs().filter((g) => g.id !== "past");
    await patchGig(String(n2.id), { action: "assign", djId: "jprime", scope: "one" });
    n2.coverage = "confirmed";
    const r = await res.PATCH(req("PATCH", { weekday: 6, start_time: "20:00", end_time: "23:00" }), P);
    expect(r.status).toBe(200);
    expect(db.residency_gigs.find((g) => g.id === "past")).toMatchObject({ start_time: "12:00", outcome: "played", dj_id: "jprime" });
    expect(db.residency_gigs.some((g) => g.id === n1.id)).toBe(false); // empty Sunday removed
    expect(db.residency_gigs.find((g) => g.id === n2.id)).toMatchObject({ dj_id: "jprime", coverage: "confirmed" }); // edited on its own: kept
    const future = gigs().filter((g) => String(g.gig_date) >= today && g.id !== n2.id);
    expect(future.every((g) => weekdayOf(String(g.gig_date)) === 6 && g.start_time === "20:00")).toBe(true);
  });

  it("played gig awaiting its recap, then the DJ's recap with an issue", async () => {
    await res.POST(req("POST", weekly), P);
    const g = gigs()[0]!;
    await patchGig(String(g.id), { action: "assign", djId: "jprime", scope: "one" });
    // the DJ confirms
    asDj("u-jprime");
    expect((await djGig.POST(req("POST", { action: "confirm" }), { params: Promise.resolve({ gigId: String(g.id) }) })).status).toBe(200);
    expect(g.coverage).toBe("confirmed");
    // the date passes; staff mark it played
    g.gig_date = g.slot_date = addDays(today, -1);
    asStaff();
    await patchGig(String(g.id), { action: "played" });
    let v = await view();
    expect(v.gigs.find((x) => x.id === g.id)).toMatchObject({ status: { label: "Recap due" } });
    // only the assigned DJ can send it
    asDj("u-penny");
    expect((await djGig.GET(req("GET"), { params: Promise.resolve({ gigId: String(g.id) }) })).status).toBe(403);
    asDj("u-jprime");
    const sent = await djGig.POST(req("POST", { action: "recap", recap: { picked_up: "Around 2 PM", worked: "Throwbacks", next_dj: "Volume down during food", issue: "House mixer channel 2 is dead" } }), { params: Promise.resolve({ gigId: String(g.id) }) });
    expect(sent.status).toBe(200);
    expect((await djGig.POST(req("POST", { action: "recap", recap: { picked_up: "x", worked: "y", next_dj: "z" } }), { params: Promise.resolve({ gigId: String(g.id) }) })).status).toBe(409);
    expect(db.tasks[0].title).toMatch(/Follow up: issue/);
    asStaff();
    v = await view();
    expect(v.gigs.find((x) => x.id === g.id)).toMatchObject({ status: { label: "Played" }, issueOpen: true });
    // pin the advice: the recap stays as written
    const pin = await (await import("@/app/api/admin/venues/[id]/brief/route")).POST(req("POST", { text: "Keep volume down during food", recapId: db.residency_recaps[0].id }), { params: Promise.resolve({ id: "v1" }) });
    expect(pin.status).toBe(200);
    expect(db.residency_recaps[0].next_dj).toBe("Volume down during food");
    await patchGig(String(g.id), { action: "resolve_issue" });
    expect(db.residency_recaps[0].issue_resolved_at).toBeTruthy();
  });

  it("a DJ declining puts the date back to unassigned", async () => {
    await res.POST(req("POST", weekly), P);
    const g = gigs()[0]!;
    await patchGig(String(g.id), { action: "assign", djId: "penny", scope: "one" });
    asDj("u-penny");
    await djGig.POST(req("POST", { action: "decline" }), { params: Promise.resolve({ gigId: String(g.id) }) });
    expect(g).toMatchObject({ dj_id: null, coverage: "unassigned" });
  });
});

describe("money stays with finance staff", () => {
  it("no finance permission: no rates in the view, no financials, no money changes", async () => {
    await res.POST(req("POST", weekly), P);
    perms = new Set();
    me = { id: "mgr", role: "manager" };
    const v = await view();
    expect(v.residency).not.toHaveProperty("venue_fee_cents");
    expect(v.residency).not.toHaveProperty("money_notes");
    expect(v.gigs.every((g) => g.venue_fee_cents === null && g.dj_payout_cents === null)).toBe(true);
    expect((await fin.GET(req("GET", undefined, "http://x/api?month=2026-11"), P)).status).toBe(403);
    expect((await patchGig(String(gigs()[0].id), { action: "set_money", venueFee: "1" })).status).toBe(403);
    expect((await res.PATCH(req("PATCH", { venueFee: "1" }), P)).status).toBe(403);
    // and a DJ can't reach staff routes at all
    asDj("u-jprime");
    expect((await res.GET(req("GET"), P)).status).toBe(403);
  });

  it("venue payments and DJ payouts are kept per gig", async () => {
    await res.POST(req("POST", weekly), P);
    const g = gigs()[0]!;
    await patchGig(String(g.id), { action: "assign", djId: "jprime", scope: "one" });
    g.coverage = "confirmed";
    g.gig_date = g.slot_date = addDays(today, -2);
    await patchGig(String(g.id), { action: "played" });
    expect((await patchGig(String(g.id), { action: "venue_paid", method: "check" })).status).toBe(200);
    expect((await patchGig(String(g.id), { action: "venue_paid", method: "check" })).status).toBe(409);
    expect((await patchGig(String(g.id), { action: "payout", status: "paid" })).status).toBe(200);
    expect(db.payments[0]).toMatchObject({ gig_id: g.id, amount_cents: 40000, kind: "gig" });
    expect(db.payouts[0]).toMatchObject({ gig_id: g.id, dj_id: "jprime", amount_cents: 25000, status: "paid" });
    const month = String(g.gig_date).slice(0, 7);
    const f = await (await fin.GET(req("GET", undefined, `http://x/api?month=${month}`), P)).json();
    expect(f.summary).toMatchObject({ played: 1, venueOutstandingCents: 0, payoutOutstandingCents: 0 });
  });

  it("adding a one-off date can't duplicate a scheduled one", async () => {
    await res.POST(req("POST", weekly), P);
    expect((await gigsRoute.POST(req("POST", { date: String(gigs()[0].gig_date) }), P)).status).toBe(409);
    const sat = addDays(String(gigs()[0].gig_date), -1);
    expect((await gigsRoute.POST(req("POST", { date: sat, djId: "penny" }), P)).status).toBe(200);
    expect(gigs().find((g) => g.gig_date === sat)).toMatchObject({ source: "manual", coverage: "awaiting", detached: true });
  });
});
