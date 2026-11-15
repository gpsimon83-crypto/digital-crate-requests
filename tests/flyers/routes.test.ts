import { beforeEach, describe, expect, it, vi } from "vitest";
import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { sampleTemplateContent } from "@/lib/flyers/sample-template";
import { instantiate } from "@/lib/flyers/scene";
import type { Scene, TextNode } from "@/lib/flyers/types";

/* ---------- in-memory Supabase ---------- */
type Row = Record<string, unknown>;
const db: Record<string, Row[]> = {};
const storage = new Map<string, Uint8Array>();
const log: { table: string; op: string }[] = [];
let user: { id: string; app_metadata: { role?: string } } | null = null;

function jsonContains(a: unknown, b: unknown): boolean {
  if (Array.isArray(b)) return Array.isArray(a) && b.every((x) => a.some((y) => jsonContains(y, x)));
  if (b && typeof b === "object") return !!a && typeof a === "object" && Object.entries(b).every(([k, v]) => jsonContains((a as Record<string, unknown>)[k], v));
  return a === b;
}

function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let op: "select" | "insert" | "update" | "delete" = "select";
  let payload: Row | Row[] | null = null;
  let count = false;
  const rows = () => (db[table] ??= []);
  const run = (mode: "many" | "single" | "maybe") => {
    log.push({ table, op });
    if (op === "insert") {
      const list: Row[] = (Array.isArray(payload) ? payload : [payload!]).map((p) => ({ id: randomUUID(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...p }));
      if (table === "flyer_templates" && list.some((r) => r.slug && rows().some((x) => x.slug === r.slug))) return { data: null, error: { code: "23505", message: "dup" } };
      rows().push(...list);
      return { data: mode === "many" ? list : list[0], error: null };
    }
    const hit = rows().filter((r) => filters.every((f) => f(r)));
    if (op === "update") hit.forEach((r) => Object.assign(r, payload));
    if (op === "delete") db[table] = rows().filter((r) => !hit.includes(r));
    if (count) return { data: null, count: hit.length, error: null };
    if (mode === "many") return { data: hit, error: null };
    if (mode === "single" && hit.length !== 1) return { data: null, error: { message: "not single" } };
    return { data: hit[0] ?? null, error: null };
  };
  const q = {
    select: (_c?: string, o?: { count?: string }) => ((count = !!o?.count), q),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    in: (k: string, v: unknown[]) => (filters.push((r) => v.includes(r[k])), q),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    lt: (k: string, v: string) => (filters.push((r) => String(r[k] ?? "") < v), q),
    // PostgREST "a.ilike.*x*,b.ilike.*y*": any of them.
    or: (expr: string) => (
      filters.push((r) =>
        expr.split(",").some((part) => {
          const m = /^(\w+)\.ilike\.\*(.*)\*$/.exec(part);
          return !!m && String(r[m[1]] ?? "").toLowerCase().includes(m[2].toLowerCase());
        })
      ),
      q
    ),
    gte: (k: string, v: string) => (filters.push((r) => String(r[k] ?? "") >= v), q),
    contains: (k: string, v: unknown) => (filters.push((r) => jsonContains(r[k], v)), q),
    order: () => q,
    limit: () => q,
    insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), q),
    update: (p: Row) => ((op = "update"), (payload = p), q),
    delete: () => ((op = "delete"), q),
    maybeSingle: () => Promise.resolve(run("maybe")),
    single: () => Promise.resolve(run("single")),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run("many")).then(res, rej)
  };
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (t: string) => query(t),
    storage: {
      from: () => ({
        upload: async (p: string, b: Uint8Array) => (storage.set(p, b), { error: null }),
        download: async (p: string) => (storage.has(p) ? { data: new Blob([storage.get(p)! as BlobPart]), error: null } : { data: null, error: { message: "missing" } }),
        remove: async (ps: string[]) => (ps.forEach((p) => storage.delete(p)), { error: null })
      })
    }
  })
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }) }));
vi.mock("@/lib/security/mfa", () => ({ staffSessionMeetsMfa: async () => true }));

/* ---------- fixtures ---------- */
const DJ_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const DJ_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const USER_A = "user-a";
const USER_B = "user-b";
const STAFF = "user-staff";
const asA = () => (user = { id: USER_A, app_metadata: { role: "dj" } });
const asB = () => (user = { id: USER_B, app_metadata: { role: "dj" } });
const asStaff = () => (user = { id: STAFF, app_metadata: { role: "admin" } });

const req = (url: string, init?: { method?: string; body?: unknown; form?: FormData }) =>
  new NextRequest(`https://www.cratesdjs.com${url}`, {
    method: init?.method ?? "GET",
    body: init?.form ?? (init?.body !== undefined ? JSON.stringify(init.body) : undefined),
    headers: init?.form ? undefined : { "Content-Type": "application/json" }
  });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = (o: Record<string, string>): any => ({ params: Promise.resolve(o) });
const json = async (r: Response) => ({ status: r.status, body: await r.json().catch(() => null) });

let designA: string;
let uploadB: string;
let sharedAsset: string;
let eventA: string;
let eventB: string;

beforeEach(() => {
  for (const k of Object.keys(db)) delete db[k];
  storage.clear();
  log.length = 0;
  db.djs = [
    { id: DJ_A, auth_user_id: USER_A, display_name: "DJ Que", photo_url: null },
    { id: DJ_B, auth_user_id: USER_B, display_name: "DJ Peace", photo_url: null }
  ];
  db.venues = [{ id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc", name: "Kyote's Bar N Grill", logo_url: null, address_line1: "1 Main St", city: "Waukesha", state: "WI", postal_code: "53186", location: null }];
  eventA = randomUUID();
  eventB = randomUUID();
  db.events = [
    { id: eventA, dj_id: DJ_A, title: "Thanksgiving Eve", starts_at: "2026-11-26T03:30:00Z", ends_at: "2026-11-26T07:00:00Z", timezone: "America/Chicago", venue_id: db.venues[0].id, venue_name: null, status: "confirmed", venues: db.venues[0] },
    { id: eventB, dj_id: DJ_B, title: "B's gig", starts_at: "2026-11-27T03:30:00Z", ends_at: null, timezone: null, venue_id: null, venue_name: null, status: "confirmed", venues: null }
  ];
  const scene = instantiate(sampleTemplateContent().formats.square!, { values: { dj_name: "DJ Que" }, djId: DJ_A, venueId: null });
  designA = randomUUID();
  db.flyer_designs = [{ id: designA, dj_id: DJ_A, title: "A's flyer", format: "square", width: 1080, height: 1080, scene, updated_at: "2026-11-13T00:00:00.000Z", template_id: null, template_version_id: null, event_id: null }];
  uploadB = randomUUID();
  sharedAsset = randomUUID();
  db.flyer_assets = [
    { id: uploadB, scope: "dj", owner_dj_id: DJ_B, storage_path: `dj/${DJ_B}/x.png`, mime: "image/png" },
    { id: sharedAsset, scope: "template", owner_dj_id: null, storage_path: "template/bg.png", mime: "image/png" }
  ];
  storage.set(`dj/${DJ_B}/x.png`, new Uint8Array([1]));
  storage.set("template/bg.png", new Uint8Array([2]));
});

const designRoute = () => import("@/app/api/flyers/designs/[id]/route");

describe("who can open a flyer", () => {
  it("its DJ and staff can; another DJ, a venue login or nobody can't", async () => {
    const { GET } = await designRoute();
    asA();
    expect((await GET(req(`/api/flyers/designs/${designA}`), p({ id: designA }))).status).toBe(200);
    asStaff();
    expect((await GET(req(`/api/flyers/designs/${designA}`), p({ id: designA }))).status).toBe(200);
    asB();
    expect((await GET(req(`/api/flyers/designs/${designA}`), p({ id: designA }))).status).toBe(404);
    user = { id: "venue-mgr", app_metadata: { role: "venue" } };
    expect((await GET(req(`/api/flyers/designs/${designA}`), p({ id: designA }))).status).toBe(403);
    user = null;
    expect((await GET(req(`/api/flyers/designs/${designA}`), p({ id: designA }))).status).toBe(401);
  });
  it("another DJ can't save over or delete it", async () => {
    const { PATCH, DELETE } = await designRoute();
    asB();
    expect((await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { title: "hacked" } }), p({ id: designA }))).status).toBe(404);
    expect((await DELETE(req(`/api/flyers/designs/${designA}`, { method: "DELETE" }), p({ id: designA }))).status).toBe(404);
    expect(db.flyer_designs[0].title).toBe("A's flyer");
  });
  it("the bootstrap list only has the DJ's own flyers and uploads", async () => {
    const { GET } = await import("@/app/api/flyers/route");
    asB();
    const r = await json(await GET());
    expect(r.status).toBe(200);
    expect(r.body.designs).toHaveLength(0);
    expect(r.body.uploads.map((u: Row) => u.id)).toEqual([uploadB]);
    asA();
    const a = await json(await GET());
    expect(a.body.designs.map((d: Row) => d.id)).toEqual([designA]);
    expect(a.body.uploads).toHaveLength(0);
    expect(a.body.templates.length).toBeGreaterThan(0); // sample template seeded and published
    expect(a.body.events.map((e: Row) => e.id)).toEqual([eventA]);
  });
});

describe("saving a flyer", () => {
  const scene = () => JSON.parse(JSON.stringify(db.flyer_designs[0].scene)) as Scene;
  it("saves allowed edits", async () => {
    const { PATCH } = await designRoute();
    asA();
    const s = scene();
    const title = s.nodes.find((n) => n.role === "title") as TextNode;
    title.text = "Thanksgiving Eve";
    title.y += 30;
    const r = await json(await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { scene: s, title: "Turkey Bash" } }), p({ id: designA })));
    expect(r.status).toBe(200);
    expect(((db.flyer_designs[0].scene as Scene).nodes.find((n) => n.id === title.id) as TextNode).text).toBe("Thanksgiving Eve");
  });
  it("refuses moving a template-locked layer (staff may)", async () => {
    const { PATCH } = await designRoute();
    asA();
    const s = scene();
    s.nodes[0].x = 50;
    const r = await json(await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { scene: s } }), p({ id: designA })));
    expect(r.status).toBe(403);
    asStaff();
    expect((await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { scene: s } }), p({ id: designA }))).status).toBe(200);
  });
  it("refuses another DJ's upload or photo inside the flyer", async () => {
    const { PATCH } = await designRoute();
    asA();
    const s = scene();
    const portrait = s.nodes.find((n) => n.role === "portrait")!;
    if (portrait.kind === "image") portrait.source = { type: "asset", assetId: uploadB };
    expect((await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { scene: s } }), p({ id: designA }))).status).toBe(400);
    if (portrait.kind === "image") portrait.source = { type: "dj_photo", djId: DJ_B };
    expect((await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { scene: s } }), p({ id: designA }))).status).toBe(400);
    if (portrait.kind === "image") portrait.source = { type: "asset", assetId: sharedAsset };
    expect((await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { scene: s } }), p({ id: designA }))).status).toBe(200);
  });
  it("won't overwrite a newer save from another window", async () => {
    const { PATCH } = await designRoute();
    asA();
    const r = await json(await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { title: "x", baseUpdatedAt: "2020-01-01T00:00:00.000Z" } }), p({ id: designA })));
    expect(r.status).toBe(409);
  });
});

describe("images", () => {
  it("a DJ's upload is private; template assets are shared", async () => {
    const { GET } = await import("@/app/api/flyers/assets/[id]/route");
    asA();
    expect((await GET(req(`/api/flyers/assets/${uploadB}`), p({ id: uploadB }))).status).toBe(404);
    const shared = await GET(req(`/api/flyers/assets/${sharedAsset}`), p({ id: sharedAsset }));
    expect(shared.status).toBe(200);
    expect(shared.headers.get("content-type")).toBe("image/png");
    asB();
    expect((await GET(req(`/api/flyers/assets/${uploadB}`), p({ id: uploadB }))).status).toBe(200);
  });
  it("DJ photos load for any signed-in DJ or staff (flyers can feature several DJs), never for venue logins", async () => {
    const { GET } = await import("@/app/api/flyers/photo/[djId]/route");
    user = { id: "venue-mgr", app_metadata: { role: "venue" } };
    expect((await GET(req(`/api/flyers/photo/${DJ_B}`), p({ djId: DJ_B }))).status).toBe(403);
    asA();
    expect((await GET(req(`/api/flyers/photo/${DJ_B}`), p({ djId: DJ_B }))).status).toBe(404); // DJ B has no photo yet
  });
  it("uploads are checked by content and go only to your own library", async () => {
    const { POST } = await import("@/app/api/flyers/assets/route");
    const png = new Uint8Array(80);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
    new DataView(png.buffer).setUint32(16, 600);
    new DataView(png.buffer).setUint32(20, 800);
    png[25] = 6;
    const form = (bytes: Uint8Array, extra: Record<string, string> = {}) => {
      const f = new FormData();
      f.append("file", new File([bytes as BlobPart], "me.png", { type: "image/png" }));
      for (const [k, v] of Object.entries(extra)) f.append(k, v);
      return f;
    };
    asA();
    const ok = await json(await POST(req("/api/flyers/assets", { method: "POST", form: form(png, { kind: "photo" }) })));
    expect(ok.status).toBe(200);
    expect(ok.body.asset).toMatchObject({ width: 600, height: 800, has_alpha: true });
    expect((await POST(req("/api/flyers/assets", { method: "POST", form: form(png, { scope: "template" }) }))).status).toBe(403);
    expect((await POST(req("/api/flyers/assets", { method: "POST", form: form(png, { djId: DJ_B }) }))).status).toBe(403);
    expect((await POST(req("/api/flyers/assets", { method: "POST", form: form(new TextEncoder().encode("<svg/>")) }))).status).toBe(400);
  });
});

describe("templates", () => {
  it("only staff manage templates", async () => {
    const { GET, POST } = await import("@/app/api/admin/flyers/templates/route");
    asA();
    expect((await GET()).status).toBe(403);
    expect((await POST(req("/api/admin/flyers/templates", { method: "POST", body: { name: "x" } }))).status).toBe(403);
    asStaff();
    const r = await json(await GET());
    expect(r.status).toBe(200);
    expect(r.body.templates[0]).toMatchObject({ slug: "sample-club-night", status: "published", current_version: 1 });
  });
  it("a flyer keeps its template version when a new version is published; bookings are never changed", async () => {
    asStaff();
    const { GET } = await import("@/app/api/admin/flyers/templates/route");
    await GET();
    const t = db.flyer_templates[0];
    const v1 = t.current_version_id;

    asA();
    const { POST: create } = await import("@/app/api/flyers/designs/route");
    const made = await json(await create(req("/api/flyers/designs", { method: "POST", body: { templateId: t.id, format: "story", eventId: eventA } })));
    expect(made.status).toBe(200);
    const d = db.flyer_designs.find((x) => x.id === made.body.id)!;
    expect(d.template_version_id).toBe(v1);
    const texts = (d.scene as Scene).nodes.filter((n): n is TextNode => n.kind === "text").map((n) => n.text);
    expect(texts).toContain("Thanksgiving Eve");
    expect(texts).toContain("Wednesday, November 25");
    expect(texts).toContain("9:30 PM – 1 AM");
    expect(texts).toContain("1 Main St, Waukesha, WI 53186");
    expect(log.some((l) => l.table === "events" && l.op !== "select")).toBe(false);

    // Another DJ's booking can't be used.
    expect((await create(req("/api/flyers/designs", { method: "POST", body: { templateId: t.id, format: "story", eventId: eventB } }))).status).toBe(403);

    asStaff();
    const { POST: publish } = await import("@/app/api/admin/flyers/templates/[id]/publish/route");
    const pub = await json(await publish(req(`/api/admin/flyers/templates/${t.id}/publish`, { method: "POST" }), p({ id: t.id as string })));
    expect(pub.body.version.version).toBe(2);
    expect(db.flyer_templates[0].current_version_id).not.toBe(v1);
    expect(d.template_version_id).toBe(v1);
    expect(db.flyer_template_versions).toHaveLength(2);
  });
});

describe("asset library", () => {
  const assets = () => import("@/app/api/flyers/assets/route");
  const one = () => import("@/app/api/flyers/assets/[id]/route");
  it("lists only your own uploads; template art is staff-only", async () => {
    const { GET } = await assets();
    asA();
    expect((await json(await GET(req("/api/flyers/assets?scope=dj")))).body.assets).toHaveLength(0);
    expect((await GET(req(`/api/flyers/assets?scope=dj&dj=${DJ_B}`))).status).toBe(403);
    expect((await GET(req("/api/flyers/assets?scope=template"))).status).toBe(403);
    asB();
    expect((await json(await GET(req("/api/flyers/assets?scope=dj")))).body.assets.map((a: Row) => a.id)).toEqual([uploadB]);
    asStaff();
    expect((await json(await GET(req("/api/flyers/assets?scope=template")))).body.assets.map((a: Row) => a.id)).toEqual([sharedAsset]);
  });
  it("rename / folder / type: owner or staff only, with valid types", async () => {
    const { PATCH } = await one();
    asA();
    expect((await PATCH(req(`/api/flyers/assets/${uploadB}`, { method: "PATCH", body: { name: "x" } }), p({ id: uploadB }))).status).toBe(404);
    expect((await PATCH(req(`/api/flyers/assets/${sharedAsset}`, { method: "PATCH", body: { folder: "x" } }), p({ id: sharedAsset }))).status).toBe(403);
    asB();
    const r = await json(await PATCH(req(`/api/flyers/assets/${uploadB}`, { method: "PATCH", body: { name: "Me <b>live</b>", folder: "  Press / shots  ", kind: "photo" } }), p({ id: uploadB })));
    expect(r.status).toBe(200);
    expect(r.body.asset).toMatchObject({ name: "Me bliveb", folder: "Press shots", kind: "photo" });
    expect((await PATCH(req(`/api/flyers/assets/${uploadB}`, { method: "PATCH", body: { kind: "background" } }), p({ id: uploadB }))).status).toBe(400);
  });
  it("won't silently delete an image a flyer or template uses", async () => {
    const { DELETE } = await one();
    const s = db.flyer_designs[0].scene as Scene;
    const portrait = s.nodes.find((n) => n.role === "portrait")!;
    if (portrait.kind === "image") portrait.source = { type: "asset", assetId: sharedAsset };
    db.flyer_templates = [{ id: randomUUID(), name: "Halloween", draft: { formats: { square: { nodes: [{ source: { assetId: sharedAsset } }] } } } }];
    asStaff();
    const r = await json(await DELETE(req(`/api/flyers/assets/${sharedAsset}`, { method: "DELETE" }), p({ id: sharedAsset })));
    expect(r.status).toBe(409);
    expect(r.body.usage).toMatchObject({ designs: 1, templates: ["Halloween"] });
    expect(db.flyer_assets.some((a) => a.id === sharedAsset)).toBe(true);
    expect((await DELETE(req(`/api/flyers/assets/${sharedAsset}?force=1`, { method: "DELETE" }), p({ id: sharedAsset }))).status).toBe(200);
    expect(db.flyer_assets.some((a) => a.id === sharedAsset)).toBe(false);
    expect(storage.has("template/bg.png")).toBe(false);
  });
  it("a DJ can't delete template art or another DJ's upload", async () => {
    const { DELETE } = await one();
    asA();
    expect((await DELETE(req(`/api/flyers/assets/${sharedAsset}`, { method: "DELETE" }), p({ id: sharedAsset }))).status).toBe(403);
    expect((await DELETE(req(`/api/flyers/assets/${uploadB}`, { method: "DELETE" }), p({ id: uploadB }))).status).toBe(404);
    asB();
    expect((await DELETE(req(`/api/flyers/assets/${uploadB}`, { method: "DELETE" }), p({ id: uploadB }))).status).toBe(200);
  });
});

/* ---------- linked to events (migration 0052 columns present) ---------- */
describe("flyers linked to events: two venues, two DJs", () => {
  const VENUE_2 = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
  let eventC: string;
  let tplA: string;
  let tplB: string;
  beforeEach(() => {
    db.venues.push({ id: VENUE_2, name: "Peace Lounge", logo_url: "x", address_line1: "9 Oak Ave", city: "Milwaukee", state: "WI", postal_code: "53202", location: null, default_drink_specials: "$4 Rail drinks" });
    eventC = randomUUID();
    // DJ Peace leads at venue 2; DJ Que is on the crew.
    db.events.push({ id: eventC, dj_id: DJ_B, title: "Peace Saturdays", starts_at: "2026-11-29T03:00:00Z", ends_at: "2026-11-29T07:00:00Z", timezone: "America/Chicago", venue_id: VENUE_2, venue_name: null, status: "confirmed", venues: db.venues[1] });
    db.event_staff_assignments = [{ id: randomUUID(), event_id: eventC, dj_id: DJ_A, status: "confirmed" }];
    db.venue_night_plans = [{ id: randomUUID(), venue_id: db.venues[0].id, night_date: "2026-11-25", location_id: "", drink_specials: "$5 Margaritas" }];
    for (const d of db.flyer_designs) Object.assign(d, { venue_id: null, dj_slots: null, exported_at: null });
    tplA = randomUUID();
    tplB = randomUUID();
    const vA = randomUUID();
    const vB = randomUUID();
    const content = sampleTemplateContent();
    db.flyer_templates = [
      { id: tplA, name: "House", status: "published", venue_id: null, current_version_id: vA, updated_at: "2026-11-01" },
      { id: tplB, name: "Peace", status: "published", venue_id: VENUE_2, current_version_id: vB, updated_at: "2026-11-02" }
    ];
    db.flyer_template_versions = [
      { id: vA, template_id: tplA, version: 1, content },
      { id: vB, template_id: tplB, version: 1, content }
    ];
    db.flyer_template_activations = [];
  });

  it("switching events fills that event's venue, DJs and specials; the event and DJ records never change", async () => {
    const { GET, PATCH } = await designRoute();
    const eventsBefore = JSON.stringify(db.events);
    const djsBefore = JSON.stringify(db.djs);
    asA();
    let r = await json(await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { eventId: eventA } }), p({ id: designA })));
    expect(r.status).toBe(200);
    expect(r.body.context.venue.name).toBe("Kyote's Bar N Grill");
    expect(r.body.context.values.dj_name).toBe("DJ Que");
    expect(r.body.context.drinkSpecials).toEqual({ text: "$5 Margaritas", from: "night" });
    r = await json(await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { eventId: eventC } }), p({ id: designA })));
    expect(r.status).toBe(200);
    expect(r.body.context.venue.name).toBe("Peace Lounge");
    expect(r.body.context.values.venue_address).toContain("9 Oak Ave");
    // The event's lead fills slot 1, the crew DJ slot 2; no night plan → the venue default.
    expect(r.body.context.slots.slice(0, 2)).toEqual([DJ_B, DJ_A]);
    expect(r.body.context.values.dj2_name).toBe("DJ Que");
    expect(r.body.context.drinkSpecials).toEqual({ text: "$4 Rail drinks", from: "venue" });
    expect(JSON.stringify(db.events)).toBe(eventsBefore);
    expect(JSON.stringify(db.djs)).toBe(djsBefore);
    // GET returns the same data for the editor.
    const g = await json(await GET(req(`/api/flyers/designs/${designA}`), p({ id: designA })));
    expect(g.body.linksReady).toBe(true);
    expect(g.body.context.event.id).toBe(eventC);
  });

  it("a DJ can only link their own events and only put that event's DJs in slots; staff can assign anyone", async () => {
    const { PATCH } = await designRoute();
    asA();
    expect((await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { eventId: eventB } }), p({ id: designA }))).status).toBe(403);
    await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { eventId: eventA } }), p({ id: designA }));
    expect((await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { djSlots: [DJ_A, DJ_B] } }), p({ id: designA }))).status).toBe(403);
    await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { eventId: eventC } }), p({ id: designA }));
    expect((await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { djSlots: [DJ_A, DJ_B] } }), p({ id: designA }))).status).toBe(200);
    asStaff();
    await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { eventId: eventA } }), p({ id: designA }));
    const r = await json(await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { djSlots: [DJ_B] } }), p({ id: designA })));
    expect(r.status).toBe(200);
    expect(r.body.context.values.dj_name).toBe("DJ Peace");
  });

  it("the active template resolves event → venue → company", async () => {
    const acts = await import("@/app/api/admin/flyers/activations/route");
    const { GET } = await import("@/app/api/flyers/designs/route");
    asStaff();
    expect((await acts.POST(req("/api/admin/flyers/activations", { method: "POST", body: { scope: "company", templateId: tplA } }))).status).toBe(200);
    expect((await acts.POST(req("/api/admin/flyers/activations", { method: "POST", body: { scope: "venue", venueId: VENUE_2, templateId: tplB } }))).status).toBe(200);
    let r = await json(await GET(req(`/api/flyers/designs?event=${eventA}`)));
    expect(r.body).toEqual({ templateId: tplA, via: "company" });
    r = await json(await GET(req(`/api/flyers/designs?event=${eventC}`)));
    expect(r.body).toEqual({ templateId: tplB, via: "venue" });
    await acts.POST(req("/api/admin/flyers/activations", { method: "POST", body: { scope: "event", eventId: eventC, templateId: tplA } }));
    r = await json(await GET(req(`/api/flyers/designs?event=${eventC}`)));
    expect(r.body).toEqual({ templateId: tplA, via: "event" });
    asA();
    expect((await acts.POST(req("/api/admin/flyers/activations", { method: "POST", body: { scope: "company", templateId: tplB } }))).status).toBe(403);
  });

  it("applying a newly active template to drafts skips exported flyers and keeps overrides", async () => {
    const acts = await import("@/app/api/admin/flyers/activations/route");
    const apply = await import("@/app/api/admin/flyers/activations/apply/route");
    const { PATCH } = await designRoute();
    asA();
    await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { eventId: eventC } }), p({ id: designA }));
    // DJ overrides one linked text on their draft.
    const d = db.flyer_designs[0] as { scene: Scene };
    const t = d.scene.nodes.find((n) => n.kind === "text" && n.source) as TextNode;
    Object.assign(t, { text: "MY OWN WORDS", override: true });
    // A second, exported flyer at the same venue.
    const exported = randomUUID();
    db.flyer_designs.push({ ...structuredClone(db.flyer_designs[0]), id: exported, exported_at: "2026-11-14T00:00:00Z", template_id: null });
    asStaff();
    await acts.POST(req("/api/admin/flyers/activations", { method: "POST", body: { scope: "venue", venueId: VENUE_2, templateId: tplB } }));
    const count = await json(await apply.GET(req(`/api/admin/flyers/activations/apply?template=${tplB}`)));
    expect(count.body.drafts).toBe(1);
    const r = await json(await apply.POST(req("/api/admin/flyers/activations/apply", { method: "POST", body: { templateId: tplB } })));
    expect(r.body).toMatchObject({ applied: 1 });
    const draft = db.flyer_designs.find((x) => x.id === designA) as { template_id: string; scene: Scene };
    const ex = db.flyer_designs.find((x) => x.id === exported) as { template_id: string | null };
    expect(draft.template_id).toBe(tplB);
    expect(draft.scene.nodes.some((n) => n.kind === "text" && n.text === "MY OWN WORDS" && n.override)).toBe(true);
    expect(ex.template_id).toBeNull();
  });

  it("cutouts and name logos: a DJ's upload waits for approval; staff approve and pick the preferred one", async () => {
    const assets = await import("@/app/api/flyers/assets/[id]/route");
    const c1 = randomUUID();
    const c2 = randomUUID();
    db.flyer_assets.push(
      { id: c1, scope: "dj", owner_dj_id: DJ_A, kind: "cutout", approved: true, is_primary: true, storage_path: "c1", mime: "image/png" },
      { id: c2, scope: "dj", owner_dj_id: DJ_A, kind: "image", approved: true, is_primary: false, storage_path: "c2", mime: "image/png" }
    );
    asA();
    let r = await json(await assets.PATCH(req(`/api/flyers/assets/${c2}`, { method: "PATCH", body: { kind: "cutout" } }), p({ id: c2 })));
    expect(r.body.asset.approved).toBe(false);
    expect((await assets.PATCH(req(`/api/flyers/assets/${c2}`, { method: "PATCH", body: { approved: true } }), p({ id: c2 }))).status).toBe(403);
    asStaff();
    r = await json(await assets.PATCH(req(`/api/flyers/assets/${c2}`, { method: "PATCH", body: { isPrimary: true } }), p({ id: c2 })));
    expect(r.status).toBe(200);
    expect(db.flyer_assets.find((a) => a.id === c2)).toMatchObject({ approved: true, is_primary: true });
    expect(db.flyer_assets.find((a) => a.id === c1)).toMatchObject({ is_primary: false });
  });
});

describe("reusing images already uploaded", () => {
  it("staff copy template art into a DJ's library as an approved cutout; the original stays; DJs can't", async () => {
    const { POST } = await import("@/app/api/flyers/assets/copy/route");
    const src = db.flyer_assets.find((a) => a.id === sharedAsset)!;
    Object.assign(src, { kind: "background", name: "Que on white", bytes: 1, width: 800, height: 1000, has_alpha: true });
    asA();
    expect((await POST(req("/api/flyers/assets/copy", { method: "POST", body: { sourceIds: [sharedAsset], djId: DJ_A, kind: "cutout" } }))).status).toBe(403);
    asStaff();
    const r = await json(await POST(req("/api/flyers/assets/copy", { method: "POST", body: { sourceIds: [sharedAsset], djId: DJ_A, kind: "cutout" } })));
    expect(r.status).toBe(200);
    expect(r.body.assets[0]).toMatchObject({ kind: "cutout", name: "Que on white", width: 800, has_alpha: true });
    const copy = db.flyer_assets.find((a) => a.id === r.body.assets[0].id)!;
    expect(copy).toMatchObject({ scope: "dj", owner_dj_id: DJ_A, approved: true });
    expect(copy.storage_path).not.toBe(src.storage_path);
    expect(storage.get(copy.storage_path as string)).toEqual(storage.get("template/bg.png"));
    // The original is untouched and still in the template library.
    expect(db.flyer_assets.find((a) => a.id === sharedAsset)).toMatchObject({ scope: "template", kind: "background" });
    // Unknown ids and missing DJs are refused.
    expect((await POST(req("/api/flyers/assets/copy", { method: "POST", body: { sourceIds: [randomUUID()], djId: DJ_A } }))).status).toBe(404);
    expect((await POST(req("/api/flyers/assets/copy", { method: "POST", body: { sourceIds: [sharedAsset], djId: randomUUID() } }))).status).toBe(404);
  });
});

/* ---------- calendar venue nights, weddings, sending to the venue portal ---------- */
describe("flyers for Google Calendar venue nights and the venue portal", () => {
  const V = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
  const VENUE_USER = "user-venue";
  const asVenue = () => (user = { id: VENUE_USER, app_metadata: { role: "venue" } });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.now() + 5 * 86400000));
  beforeEach(() => {
    Object.assign(db.venues[0], { portal_enabled: true, is_active: true, calendar_names: ["Kyotes"], recurring_nights: [{ day: new Date(`${today}T12:00:00Z`).getUTCDay(), label: "Kyotes Thursday", start: "21:30", end: "01:00" }], locations: [] });
    db.calendar_dj_names = [{ id: "m1", calendar_name: "Peace", display_name: "DJ Peace" }];
    // An all-day calendar entry "Kyotes - Peace" five days from now.
    db.external_calendar_busy_blocks = [{ google_event_id: "g-123", summary: "Kyotes - Peace", starts_at: `${today}T00:00:00Z`, ends_at: new Date(Date.parse(`${today}T00:00:00Z`) + 86400000).toISOString() }];
    db.venue_managers = [{ id: "vm1", venue_id: V, user_id: VENUE_USER, is_active: true }];
    db.venue_flyers = [];
    for (const d of db.flyer_designs) Object.assign(d, { venue_id: null, dj_slots: null, exported_at: null, calendar_night: null });
    // A wedding: never offered for flyers.
    db.events.push({ id: randomUUID(), dj_id: DJ_A, title: "Smith Wedding", starts_at: "2026-12-05T22:00:00Z", ends_at: null, timezone: null, venue_id: null, venue_name: "Barn", status: "confirmed", event_category: "wedding", venues: null });
  });

  it("lists venue nights from the calendar (with the DJ and the venue's usual hours) and leaves weddings out", async () => {
    const { flyerEvents } = await import("@/lib/flyers/data");
    const staffList = await flyerEvents(createAdminClientForTest(), { djId: null, staff: true });
    expect(staffList.some((e) => e.title === "Smith Wedding")).toBe(false);
    const night = staffList.find((e) => e.source === "calendar")!;
    expect(night).toMatchObject({ venue_id: V, venue_name: "Kyote's Bar N Grill", dj_id: DJ_B, dj_name: "DJ Peace", title: "Kyotes Thursday", date: today });
    expect(new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", hour: "numeric", minute: "2-digit" }).format(new Date(night.starts_at!))).toBe("9:30 PM");
    // DJ Peace sees their night; DJ Que doesn't.
    expect((await flyerEvents(createAdminClientForTest(), { djId: DJ_B, staff: false })).some((e) => e.id === night.id)).toBe(true);
    expect((await flyerEvents(createAdminClientForTest(), { djId: DJ_A, staff: false })).some((e) => e.id === night.id)).toBe(false);
  });

  it("links a flyer to a calendar night, fills it, and sends the PNG to that venue's portal only", async () => {
    const { flyerEvents } = await import("@/lib/flyers/data");
    const night = (await flyerEvents(createAdminClientForTest(), { djId: null, staff: true })).find((e) => e.source === "calendar")!;
    const { PATCH } = await designRoute();
    asA();
    // DJ Que isn't on that night.
    expect((await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { eventId: night.id } }), p({ id: designA }))).status).toBe(403);
    asStaff();
    const r = await json(await PATCH(req(`/api/flyers/designs/${designA}`, { method: "PATCH", body: { eventId: night.id } }), p({ id: designA })));
    expect(r.status).toBe(200);
    expect(r.body.context.values).toMatchObject({ venue_name: "Kyote's Bar N Grill", dj_name: "DJ Peace", start_time: "9:30 PM", end_time: "1 AM", event_title: "Kyotes Thursday" });
    expect(r.body.context.slots[0]).toBe(DJ_B);

    // Send it: a real PNG, stored, listed for the venue, downloadable by its manager.
    const send = await import("@/app/api/flyers/designs/[id]/send/route");
    const fd = new FormData();
    fd.append("file", new File([tinyPng() as BlobPart], "flyer.png", { type: "image/png" }));
    fd.append("note", "Post Thursday");
    const sent = await json(await send.POST(req(`/api/flyers/designs/${designA}/send`, { method: "POST", form: fd }), p({ id: designA })));
    expect(sent.status).toBe(200);
    expect(sent.body.venue.id).toBe(V);
    const row = db.venue_flyers[0];
    row.hidden ??= false; // the column default in Postgres
    expect(row).toMatchObject({ venue_id: V, design_id: designA, night_date: today, note: "Post Thursday", width: 1080, height: 1350 });
    expect(db.flyer_designs.find((d) => d.id === designA)!.exported_at).toBeTruthy();

    const list = await import("@/app/api/venue/flyers/route");
    const img = await import("@/app/api/venue/flyers/[id]/route");
    asVenue();
    const l = await json(await list.GET(req(`/api/venue/flyers?venue=${V}`)));
    expect(l.body.flyers.map((f: { id: string }) => f.id)).toEqual([row.id]);
    const got = await img.GET(req(`/api/venue/flyers/${row.id}?download=1`), p({ id: row.id as string }));
    expect(got.status).toBe(200);
    expect(got.headers.get("content-disposition")).toContain(".png");
    // Another venue's manager can't see it.
    db.venue_managers = [{ id: "vm2", venue_id: randomUUID(), user_id: VENUE_USER, is_active: true }];
    expect((await img.GET(req(`/api/venue/flyers/${row.id}`), p({ id: row.id as string }))).status).not.toBe(200);
    // A DJ can't send another DJ's flyer.
    asB();
    expect((await send.POST(req(`/api/flyers/designs/${designA}/send`, { method: "POST", form: fd }), p({ id: designA }))).status).toBe(404);
  });
});

function tinyPng(): Uint8Array {
  // A 1080x1350 PNG (one color, so it stays small).
  return Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAABDgAAAVGCAIAAAD0LZzdAAAX9UlEQVR42u3XoQEAMAjAsDGJRvP/mbyARCQn1DUq+wEAAFzyJQAAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAYFQkAAAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAABgVCQAAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAGBUJAAAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAYFQkAAAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAAIwKAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAACAUQEAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAADAqAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAARgUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAMCoAAAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAGBUAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACjAgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAYFQAAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAGBUAAAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAjAoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAIBRAQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAMCoAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAABGBQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAwKgAAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAAAYFQAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAKMCAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAABgVAAAAIwKAABgVCQAAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAACMCgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAgFEBAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAAAwKgAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAAEYFAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAADAqAAAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAABgVAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAowIAAGBUAAAAjAoAAGBUAAAAtgaDAQrIU1XttgAAAABJRU5ErkJggg==", "base64"));
}
async function createAdminClientForTestAsync() {
  return (await import("@/lib/supabase/admin")).createAdminClient();
}
void createAdminClientForTestAsync;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createAdminClientForTest(): any {
  return { from: (t: string) => query(t), storage: { from: () => ({}) } };
}
