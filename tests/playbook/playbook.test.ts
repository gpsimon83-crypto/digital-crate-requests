import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomUUID } from "crypto";

/* ---------- tiny in-memory Supabase with the tasks unique index ---------- */
type Row = Record<string, unknown>;
let db: Record<string, Row[]> = {};
function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let cols = "*";
  let op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  let payload: Row | Row[] | null = null;
  const embed = (r: Row): Row => {
    const out = { ...r };
    if (table === "events") {
      if (cols.includes("venues(")) out.venues = (db.venues ?? []).find((v) => v.id === r.venue_id) ?? null;
      if (cols.includes("djs(")) out.djs = (db.djs ?? []).find((v) => v.id === r.dj_id) ?? null;
      if (cols.includes("clients(")) out.clients = (db.clients ?? []).find((v) => v.id === r.client_id) ?? null;
    }
    return out;
  };
  const run = (mode: "many" | "single" | "maybe") => {
    if (table === "playbook_task_timing" && !(table in db)) return { data: null, error: { code: "42P01", message: "missing" } };
    const rows = (db[table] ??= []);
    if (op === "insert") {
      const list: Row[] = (Array.isArray(payload) ? payload : [payload!]).map((p) => ({ id: randomUUID(), created_at: new Date().toISOString(), status: "open", data: {}, checklist: {}, due_overridden: false, ...p }));
      for (const r of list)
        if (table === "tasks" && r.template_key && rows.some((x) => x.event_id === r.event_id && x.template_key === r.template_key)) return { data: null, error: { code: "23505", message: "duplicate" } };
      rows.push(...list);
      return { data: mode === "many" ? list : list[0], error: null };
    }
    if (op === "upsert") return { data: null, error: null };
    const hit = rows.filter((r) => filters.every((f) => f(r)));
    if (op === "update") {
      hit.forEach((r) => Object.assign(r, payload));
      return { data: mode === "many" ? hit : (hit[0] ?? null), error: null };
    }
    if (op === "delete") {
      db[table] = rows.filter((r) => !hit.includes(r));
      return { data: null, error: null };
    }
    if (mode === "single") return hit.length === 1 ? { data: embed(hit[0]), error: null } : { data: null, error: { message: "not single" } };
    if (mode === "maybe") return { data: hit[0] ? embed(hit[0]) : null, error: null };
    return { data: hit.map(embed), error: null };
  };
  const q: Record<string, unknown> = {
    select: (c?: string) => ((cols = c ?? "*"), q),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    // only the claim filter: send_claimed_at.is.null,send_claimed_at.lt.<iso>
    or: (expr: string) => {
      const lt = expr.split("send_claimed_at.lt.")[1];
      filters.push((r) => r.send_claimed_at == null || String(r.send_claimed_at) < lt);
      return q;
    },
    order: () => q,
    limit: () => q,
    insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), q),
    update: (p: Row) => ((op = "update"), (payload = p), q),
    upsert: (p: Row) => ((op = "upsert"), (payload = p), q),
    delete: () => ((op = "delete"), q),
    maybeSingle: () => Promise.resolve(run("maybe")),
    single: () => Promise.resolve(run("single")),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run("many")).then(res, rej)
  };
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => query(t) }) }));
vi.mock("@/lib/data/questionnaire-links", () => ({ weddingBasicsTemplate: async () => null, linkForEvent: async () => null }));
vi.mock("@/lib/activity", () => ({ logActivity: async () => {} }));
let who: { isAdmin: boolean } = { isAdmin: true };
vi.mock("@/lib/require-event-access", () => ({ requireEventAccess: async () => ({ authorized: true, isAdmin: who.isAdmin, user: { id: "u1" } }) }));

import { syncPlaybook, playbookView } from "@/lib/data/playbook";
import { TEMPLATES } from "@/lib/playbook";
import { PATCH, DELETE } from "@/app/api/events/[id]/tasks/[taskId]/route";
import { NextRequest } from "next/server";

const EV = "ev1";
const day = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString();
function seed(over: Row = {}) {
  db = {
    events: [{ id: EV, event_category: "wedding", starts_at: day(60), timezone: "America/Chicago", created_at: day(-30), venue_id: "v1", venue_name: null, expected_guests: 120, dj_id: null, client_id: "c1", wedding_music_plan: null, wedding_music_plan_sent_at: null, package_selection_id: null, ...over }],
    venues: [{ id: "v1", name: "The Grand Barn" }, { id: "v2", name: "Lakeside Pavilion" }],
    djs: [{ id: "d1", display_name: "DJ Nova" }],
    clients: [{ id: "c1", first_name: "Avery" }],
    contracts: [],
    payments: [],
    event_package_selections: [],
    questionnaire_responses: [],
    event_equipment_plans: [],
    platform_settings: [{ id: true, review_url: "https://g.page/r/review" }],
    playbook_task_timing: [],
    tasks: []
  };
}
const ev = () => db.events[0];
const task = (key: string) => (db.tasks as Row[]).find((t) => t.template_key === key)!;
const book = () => {
  db.contracts.push({ event_id: EV, status: "signed" });
  db.payments.push({ event_id: EV, status: "succeeded" });
  ev().dj_id = "d1";
};
const patch = (id: string, body: Row) => PATCH(new NextRequest("http://x/api", { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id: EV, taskId: id }) });

beforeEach(() => {
  seed();
  who = { isAdmin: true };
});

describe("Wedding Playbook sync", () => {
  it("creates each template task once, however often it runs", async () => {
    await syncPlaybook(EV);
    await syncPlaybook(EV);
    await Promise.all([syncPlaybook(EV), syncPlaybook(EV)]);
    expect(db.tasks.length).toBe(TEMPLATES.length);
    expect(new Set(db.tasks.map((t) => t.template_key)).size).toBe(TEMPLATES.length);
  });

  it("leaves non-wedding events and manual tasks alone", async () => {
    db.tasks.push({ id: "m1", event_id: EV, title: "Call florist", due_date: "2030-01-01", status: "open", template_key: null, created_at: day(0) });
    await syncPlaybook(EV);
    expect(db.tasks.find((t) => t.id === "m1")).toMatchObject({ title: "Call florist", due_date: "2030-01-01", status: "open" });
    seed({ event_category: "birthday" });
    await syncPlaybook(EV);
    expect(db.tasks.length).toBe(0);
  });

  it("unassigned wedding: assign DJ is next for staff; the DJ's planning waits for the handoff", async () => {
    db.contracts.push({ event_id: EV, status: "signed" });
    db.payments.push({ event_id: EV, status: "succeeded" });
    db.event_package_selections.push({ event_id: EV, status: "approved", is_current: true });
    const staff = await playbookView(EV, "staff");
    expect(staff.tasks.find((t) => t.id === staff.nextUpId)?.template_key).toMatch(/inquiry_details|proposal_scope|assign_dj/);
    expect(task("contract_signed").status).toBe("done");
    expect(task("assign_dj").status).toBe("open");
    const dj = await playbookView(EV, "dj");
    expect(dj.handedOff).toBe(false);
    const review = dj.tasks.find((t) => t.template_key === "dj_review_booking")!;
    expect(review.blocked?.missing).toMatch(/assigned DJ/);
    expect(dj.nextUpId).toBeNull();
  });

  it("booked wedding waiting on the client's music: client task open, DJ music review blocked on it", async () => {
    book();
    ev().wedding_music_plan_sent_at = day(-5);
    const dj = await playbookView(EV, "dj");
    const music = dj.tasks.find((t) => t.template_key === "client_music_plan")!;
    expect(music.status).toBe("open");
    expect(music.canAct).toBe(false);
    expect(music.ownerLabel).toBe("Client");
    // filling in the first dance completes it on the next sync
    ev().wedding_music_plan = { first_dance_song: "At Last" };
    await syncPlaybook(EV);
    expect(task("client_music_plan").status).toBe("done");
  });

  it("a venue change after review reopens only the tasks that watch the venue, with the reason", async () => {
    book();
    await syncPlaybook(EV);
    who = { isAdmin: false };
    expect((await patch(task("dj_review_booking").id as string, { action: "ready" })).status).toBe(200);
    expect((await patch(task("dj_read_questionnaire").id as string, { action: "ready" })).status).toBe(200);
    expect(task("dj_review_booking").status).toBe("done");
    ev().venue_id = "v2";
    await syncPlaybook(EV);
    expect(task("dj_review_booking")).toMatchObject({ status: "open", review_note: expect.stringContaining("Venue changed") });
    expect(task("dj_read_questionnaire").status).toBe("done"); // doesn't watch the venue
  });

  it("a date change moves open due dates but keeps hand-set ones", async () => {
    await syncPlaybook(EV);
    await patch(task("dj_planning_call").id as string, { dueDate: "2031-02-02" });
    const before = task("client_music_plan").due_date;
    ev().starts_at = day(90);
    await syncPlaybook(EV);
    expect(task("client_music_plan").due_date).not.toBe(before);
    expect(task("dj_planning_call")).toMatchObject({ due_date: "2031-02-02", due_overridden: true });
  });

  it("completed wedding with an issue: review and referral held until it's resolved; thank-you is not", async () => {
    book();
    ev().starts_at = day(-3);
    await syncPlaybook(EV);
    who = { isAdmin: false };
    const r = await patch(task("dj_recap").id as string, { action: "recap", recap: { worked: "Full floor", improvement: "Earlier toasts", personal: "Grandma danced", issue: "Power tripped at dinner" } });
    expect(r.status).toBe(200);
    expect(task("resolve_issue").status).toBe("open");
    expect(task("staff_review_request")).toMatchObject({ status: "waiting", waiting_reason: expect.stringMatching(/Held/) });
    expect(task("staff_referral").status).toBe("waiting");
    expect(task("staff_thank_you").status).toBe("open");
    who = { isAdmin: true };
    expect((await patch(task("staff_review_request").id as string, { action: "claim_send" })).status).toBe(409);
    await patch(task("resolve_issue").id as string, { action: "ready" });
    expect(task("staff_review_request").status).toBe("open");
    const view = await playbookView(EV, "staff");
    expect(view.tasks.find((t) => t.template_key === "staff_thank_you")?.draft?.body).toContain("Grandma danced");
  });

  it("outreach goes out once: claim, log, then no second claim or log", async () => {
    ev().starts_at = day(-3);
    await syncPlaybook(EV);
    const id = task("staff_thank_you").id as string;
    expect((await patch(id, { action: "claim_send" })).status).toBe(200);
    expect((await patch(id, { action: "claim_send" })).status).toBe(409); // someone else mid-send
    expect((await patch(id, { action: "log_sent", draft: { subject: "Hi", body: "Thanks" } })).status).toBe(200);
    expect((await patch(id, { action: "log_sent", draft: { subject: "Hi", body: "Again" } })).status).toBe(409);
    expect((await patch(id, { action: "claim_send" })).status).toBe(409);
    expect(task("staff_thank_you")).toMatchObject({ status: "done", data: expect.objectContaining({ draft: { subject: "Hi", body: "Thanks" } }) });
  });
});

describe("Wedding Playbook roles", () => {
  it("each role sees and acts on only its own work", async () => {
    book();
    const client = await playbookView(EV, "client");
    expect(client.tasks.every((t) => t.owner === "client")).toBe(true);
    const dj = await playbookView(EV, "dj");
    expect(dj.tasks.some((t) => t.owner === "staff" || t.owner === "booking_lead")).toBe(false);
    expect(dj.tasks.filter((t) => t.canAct).every((t) => t.owner === "dj" || t.owner == null)).toBe(true);
    expect(dj.tasks.find((t) => t.template_key === "dj_review_booking")?.link?.href).toBe(`/dj-dashboard/projects/${EV}`);

    who = { isAdmin: false };
    expect((await patch(task("assign_dj").id as string, { action: "ready" })).status).toBe(403); // staff task
    expect((await patch(task("client_questionnaire").id as string, { action: "ready" })).status).toBe(403); // client task
    who = { isAdmin: true };
    expect((await patch(task("client_questionnaire").id as string, { action: "ready" })).status).toBe(403); // staff can't tick the client's
    expect((await patch(task("contract_signed").id as string, { action: "ready" })).status).toBe(403);
    expect((await patch(task("proposal_sent").id as string, { action: "ready" })).status).toBe(400); // objective
  });

  it("DJ requests go to the booking lead; the DJ can't resolve them, and playbook tasks can't be deleted", async () => {
    book();
    await syncPlaybook(EV);
    db.tasks.push({ id: "rq", event_id: EV, template_key: "request:1", owner: "booking_lead", title: "Overtime", status: "open", data: { details: "One more hour" }, created_at: day(0) });
    who = { isAdmin: false };
    expect((await patch("rq", { action: "ready" })).status).toBe(403);
    const del = await DELETE(new NextRequest("http://x/api", { method: "DELETE" }), { params: Promise.resolve({ id: EV, taskId: task("dj_recap").id as string }) });
    expect(del.status).toBe(400);
    who = { isAdmin: true };
    expect((await patch("rq", { action: "ready" })).status).toBe(200);
  });
});

describe("before migration 0059", () => {
  it("shows plain tasks and doesn't try to build the playbook", async () => {
    delete (db as Record<string, unknown>).playbook_task_timing;
    db.tasks.push({ id: "m1", event_id: EV, title: "Call florist", due_date: null, completed_at: null, created_at: day(0) });
    const v = await playbookView(EV, "staff");
    expect(v.isWedding).toBe(false);
    expect(v.tasks.map((t) => t.title)).toEqual(["Call florist"]);
  });
});
