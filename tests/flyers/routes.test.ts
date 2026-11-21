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
          if (m) return String(r[m[1]] ?? "").toLowerCase().includes(m[2].toLowerCase());
          const eq = /^(\w+)\.eq\.(.*)$/.exec(part);
          if (eq) return String(r[eq[1]] ?? "") === eq[2];
          const isNull = /^(\w+)\.is\.null$/.exec(part);
          return !!isNull && (r[isNull[1]] ?? null) === null;
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
    expect(db.flyer_template_versions.filter((v) => v.template_id === t.id)).toHaveLength(2);
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

/* ---------- Wedding Basics by private link ---------- */
describe("Wedding Basics questionnaire link (no login)", () => {
  const EV = "eeeeeeee-1111-4111-8111-111111111111";
  const CL = "cccccccc-1111-4111-8111-111111111111";
  const TPL = "abababab-1111-4111-8111-111111111111";
  const answersFull = {
    wedding_date: { value: "2027-06-12" },
    venue: { value: "The Grand Hall, Milwaukee" },
    reception_start: { value: "17:30" },
    guest_count: { value: "150" },
    partner_one_name: { value: "Caroline Catlin" },
    partner_two_name: { value: "Josh Reed" },
    married_name: { value: "Reed" },
    partner_one_phone: { value: "262-555-0123" },
    partner_two_phone: { value: "(414) 555-0199" },
    email: { value: "caroline@example.com" }
  };
  beforeEach(() => {
    const q = (sec: string, key: string, position: number, type: string) => ({ id: randomUUID(), section_id: sec, key, position, prompt: key, subtext: null, question_type: type, options: [], allow_unsure: false, required: true, depends_on_question_key: null, depends_on_values: null });
    db.questionnaire_templates = [{ id: TPL, event_type: "wedding_basics", title: "Wedding Basics", opening_heading: "x", opening_body: "x", opening_cta_label: "Go", is_active: true }];
    db.questionnaire_sections = [
      { id: "s1", template_id: TPL, key: "the_day", title: "The Day", position: 1, transition_heading: null, transition_subheading: null },
      { id: "s2", template_id: TPL, key: "the_couple", title: "The Couple", position: 2, transition_heading: null, transition_subheading: null }
    ];
    db.questionnaire_questions = [
      q("s1", "wedding_date", 1, "date"), q("s1", "venue", 2, "short_text"), q("s1", "reception_start", 3, "time"), q("s1", "guest_count", 4, "number"),
      q("s2", "partner_one_name", 1, "short_text"), q("s2", "partner_two_name", 2, "short_text"), q("s2", "married_name", 3, "short_text"),
      q("s2", "partner_one_phone", 4, "phone"), q("s2", "partner_two_phone", 5, "phone"), q("s2", "email", 6, "email")
    ];
    db.questionnaire_links = [];
    db.activity_log = [];
    // A lead with only an (undeliverable) email and a venue already set.
    db.clients = [{ id: CL, first_name: null, last_name: null, phone: null, email: "caroline@bounced.example" }];
    db.events.push({ id: EV, client_id: CL, starts_at: null, timezone: "America/Chicago", venue_name: "Kyote's Bar N Grill", expected_guests: null, couple_display_name: null, title: "Catlin wedding", event_category: "wedding" });
  });

  it("staff make a link; the client answers all 10 (checked, required), submits, answers lock, and only empty CRM fields are filled", async () => {
    const admin = await import("@/app/api/admin/events/[id]/questionnaire-link/route");
    const pub = await import("@/app/api/q/[token]/route");
    const sub = await import("@/app/api/q/[token]/submit/route");
    asA();
    expect((await admin.POST(req(`/api/admin/events/${EV}/questionnaire-link`, { method: "POST", body: { action: "create" } }), p({ id: EV }))).status).toBe(403);
    asStaff();
    const made = await json(await admin.POST(req(`/api/admin/events/${EV}/questionnaire-link`, { method: "POST", body: { action: "create" } }), p({ id: EV })));
    expect(made.status).toBe(200);
    expect(made.body.total).toBe(10);
    const token = String(made.body.link.url).split("/w/")[1];
    // The client has no name yet, so the link uses the event title.
    expect(token).toMatch(/^catlin-wedding-[a-z2-9]{10}$/);

    user = null; // the client isn't signed in
    const got = await json(await pub.GET(req(`/api/q/${token}`), p({ token })));
    expect(got.status).toBe(200);
    expect(got.body.template.sections.flatMap((s: { questions: unknown[] }) => s.questions)).toHaveLength(10);
    // Unknown keys are dropped; partial answers save.
    await pub.PATCH(req(`/api/q/${token}`, { method: "PATCH", body: { answers: { wedding_date: { value: "2027-06-12" }, hacker: { value: "x" } } } }), p({ token }));
    expect(Object.keys(db.questionnaire_links[0].answers as object)).toEqual(["wedding_date"]);
    // Missing or badly formed answers stop the submission.
    let r = await json(await sub.POST(req(`/api/q/${token}/submit`, { method: "POST", body: {} }), p({ token })));
    expect(r.status).toBe(400);
    r = await json(await sub.POST(req(`/api/q/${token}/submit`, { method: "POST", body: { answers: { ...answersFull, partner_two_phone: { value: "555" }, email: { value: "nope" } } } }), p({ token })));
    expect(r.status).toBe(400);
    expect(r.body.problems.map((x: { key: string }) => x.key)).toEqual(["partner_two_phone", "email"]);
    r = await json(await sub.POST(req(`/api/q/${token}/submit`, { method: "POST", body: { answers: answersFull } }), p({ token })));
    expect(r.status).toBe(200);

    const link = db.questionnaire_links[0];
    expect(link.locked).toBe(true);
    // Locked: no more changes through the link.
    expect((await pub.PATCH(req(`/api/q/${token}`, { method: "PATCH", body: { answers: { venue: { value: "Elsewhere" } } } }), p({ token }))).status).toBe(409);

    const ev = db.events.find((e) => e.id === EV)!;
    // 5:30 PM Chicago on June 12 2027 (CDT) = 22:30 UTC.
    expect(ev.starts_at).toBe("2027-06-12T22:30:00.000Z");
    expect(ev).toMatchObject({ expected_guests: 150, couple_display_name: "Caroline & Josh", venue_name: "Kyote's Bar N Grill" });
    expect(db.clients[0]).toMatchObject({ first_name: "Caroline", last_name: "Catlin", phone: "(262) 555-0123", email: "caroline@bounced.example" });
    const applied = link.applied as { filled: string[]; differs: { field: string }[] };
    expect(applied.filled).toEqual(expect.arrayContaining(["Date and start time", "Guest count", "Couple name", "Client first name", "Client phone"]));
    expect(applied.differs.map((d) => d.field)).toEqual(expect.arrayContaining(["Venue", "Client email"]));

    // Staff see the answers, can unlock, and a new link retires the old one.
    asStaff();
    const v = await json(await admin.GET(req(`/api/admin/events/${EV}/questionnaire-link`), p({ id: EV })));
    expect(v.body.link.answers.find((a: { prompt: string }) => a.prompt === "wedding_date").answer).toBe("Saturday, June 12, 2027");
    expect((await json(await admin.POST(req(`/api/admin/events/${EV}/questionnaire-link`, { method: "POST", body: { action: "unlock" } }), p({ id: EV })))).body.link.locked).toBe(false);
    const renewed = await json(await admin.POST(req(`/api/admin/events/${EV}/questionnaire-link`, { method: "POST", body: { action: "renew" } }), p({ id: EV })));
    const token2 = String(renewed.body.link.url).split("/w/")[1];
    expect(token2).not.toBe(token);
    user = null;
    expect((await pub.GET(req(`/api/q/${token}`), p({ token }))).status).toBe(404);
    expect((await pub.GET(req(`/api/q/${token2}`), p({ token: token2 }))).status).toBe(200);
    expect((await pub.GET(req(`/api/q/not-a-real-token`), p({ token: "not-a-real-token" }))).status).toBe(404);
  });
});

describe("Wedding Basics: staying in touch", () => {
  it("contact method, days and times are required picks and show as labels", async () => {
    const { submissionProblems } = await import("@/lib/data/questionnaire-links");
    const { displayAnswer } = await import("@/lib/questionnaire-engine");
    const opt = (v: string, l: string) => ({ value: v, label: l });
    const mk = (key: string, options: { value: string; label: string }[]) => ({ id: key, section_id: "s3", key, position: 1, prompt: key, subtext: null, question_type: "multi_select" as const, options, allow_unsure: false, required: true, depends_on_question_key: null, depends_on_values: null });
    const qs = [mk("contact_methods", [opt("text", "Text"), opt("call", "Phone call")]), mk("best_days", [opt("tue", "Tuesday"), opt("sat", "Saturday")]), mk("best_times", [opt("evening", "Evening (5 – 8 PM)")])];
    const template = { id: "t", event_type: "wedding_basics", title: "x", opening_heading: "x", opening_body: "x", opening_cta_label: "x", sections: [{ id: "s3", key: "staying_in_touch", title: "Staying in Touch", position: 3, transition_heading: null, transition_subheading: null, questions: qs }] } as never;
    expect(submissionProblems(template, { contact_methods: { value: [] } }).map((p) => p.key)).toEqual(["contact_methods", "best_days", "best_times"]);
    expect(submissionProblems(template, { contact_methods: { value: ["text"] }, best_days: { value: ["tue", "sat"] }, best_times: { value: ["evening"] } })).toEqual([]);
    expect(displayAnswer(qs[1], { value: ["tue", "sat"] })).toMatch(/Tuesday.*Saturday/);
  });
});

describe("Wedding Basics: links, client details and package recommendations", () => {
  it("links read as the couple's name plus a random code", async () => {
    const { newToken, nameSlug, tokenOk } = await import("@/lib/data/questionnaire-links");
    expect(nameSlug("Caroline Catlin")).toBe("caroline-catlin");
    expect(nameSlug("José & María O'Neil")).toBe("jose-and-maria-o-neil");
    const t = newToken("Caroline Catlin");
    expect(t).toMatch(/^caroline-catlin-[a-z2-9]{10}$/);
    expect(newToken("Caroline Catlin")).not.toBe(t);
    expect(tokenOk(t)).toBe(true);
    expect(tokenOk("caroline-catlin")).toBe(false); // no random part
    expect(tokenOk("A".repeat(43))).toBe(true); // older links still work
  });

  it("works out what the day needs from the answers", async () => {
    const { needsFromAnswers, addOnsFor } = await import("@/lib/wedding-recommend");
    const n = needsFromAnswers({
      guest_count: { value: "180" },
      reception_start: { value: "17:00" },
      reception_end: { value: "23:00" },
      coverage: { value: ["ceremony", "cocktail", "reception"] },
      ceremony_location: { value: "different" },
      indoor_outdoor: { value: "both" },
      setup_access: { value: "stairs" },
      venue: { value: "The Grand Hall, Milwaukee" }
    });
    expect(n).toMatchObject({ guests: 180, receptionHours: 6, hoursNeeded: 7.5 });
    const { addOns, notes } = addOnsFor(n);
    const by = Object.fromEntries(addOns.map((a) => [a.key, a.quantity]));
    // 101–200 guests = 1 extra speaker, + 1 because part of it is outdoors.
    expect(by).toEqual({ speaker: 2, ceremony_sound: 1, mic: 1, cocktail_sound: 1, mc: 1, setup: 1 });
    expect(notes.join(" ")).toMatch(/travel distance to The Grand Hall/);
    // Small indoor wedding, ceremony in the same room: no extra speakers, just a mic.
    const small = addOnsFor(needsFromAnswers({ guest_count: { value: "80" }, coverage: { value: ["ceremony", "reception"] }, ceremony_location: { value: "same_room" }, indoor_outdoor: { value: "indoors" }, setup_access: { value: "easy" } }));
    expect(small.addOns.map((a) => a.key).sort()).toEqual(["mc", "mic"]);
    // Late night: an end time after midnight counts the right hours.
    expect(needsFromAnswers({ reception_start: { value: "19:00" }, reception_end: { value: "01:00" }, coverage: { value: ["reception"] } }).hoursNeeded).toBe(6);
  });

  it("scores packages on guests, hours and what they include, and adds the extras", async () => {
    const { needsFromAnswers, addOnsFor, fitPackage } = await import("@/lib/wedding-recommend");
    const n = needsFromAnswers({ guest_count: { value: "180" }, reception_start: { value: "17:00" }, reception_end: { value: "22:00" }, coverage: { value: ["ceremony", "reception"] }, ceremony_location: { value: "same_venue" } });
    const { addOns } = addOnsFor(n);
    const li = (id: string, name: string, mode: string, inc = 0, max: number | null = null) => ({ id, section_id: "s", catalog_item_id: id, catalog_item: { name } as never, name_override: null, description_override: null, pricing_method_override: null, price_cents_override: null, included_quantity: inc, min_quantity: null, max_quantity: max, selection_mode: mode as never, is_client_visible: true, position: 0 });
    const tpl = (id: string, extra: object) => ({ id, name: id, tier: null, min_guest_count: null, max_guest_count: null, included_hours: null, ...extra }) as never;
    const sections = [{ id: "s", package_template_id: "x", title: "", description: null, position: 0, is_hidden: false, line_items: [li("dj", "DJ Performance", "included", 1), li("cer", "Ceremony Sound", "optional"), li("spk", "Additional Speaker", "optional", 0, 4), li("mc", "MC Services", "included", 1)] }];
    const good = fitPackage(tpl("Signature", { min_guest_count: 100, max_guest_count: 250, included_hours: 6 }), sections, n, addOns);
    expect(good.selections).toMatchObject({ dj: 1, cer: 1, spk: 1, mc: 1 });
    expect(good.why.join(" | ")).toMatch(/Built for 100–250 guests.*6 hours included.*Adds ceremony sound.*Includes MC services/);
    expect(good.notOffered.map((a) => a.key)).toEqual(["mic"]);
    const small = fitPackage(tpl("Essential", { max_guest_count: 120, included_hours: 4 }), sections, n, addOns);
    expect(small.score).toBeLessThan(good.score);
    expect(small.watch.join(" ")).toMatch(/up to 120 guests.*about 5\.5 needed/);
  });

  describe("on the event (staff and the event's DJ)", () => {
    const EV = "eeeeeeee-2222-4222-8222-222222222222";
    const CL = "cccccccc-2222-4222-8222-222222222222";
    const TPL = "abababab-2222-4222-8222-222222222222";
    const answers = {
      wedding_date: { value: "2027-06-12" },
      venue: { value: "The Grand Hall, Milwaukee" },
      reception_start: { value: "19:00" },
      reception_end: { value: "00:30" },
      guest_count: { value: "180" },
      coverage: { value: ["ceremony", "reception"] },
      ceremony_location: { value: "same_venue" },
      partner_one_name: { value: "Caroline Catlin" },
      partner_two_name: { value: "Josh Reed" },
      married_name: { value: "Reed" },
      partner_one_phone: { value: "262-555-0123" },
      partner_two_phone: { value: "4145550199" },
      email: { value: "caroline@example.com" },
      contact_methods: { value: ["text", "call"] },
      best_days: { value: ["tue", "sat"] },
      best_times: { value: ["evening"] }
    };
    beforeEach(async () => {
      const q = (key: string, position: number, type: string, options: { value: string; label: string }[] = []) => ({ id: randomUUID(), section_id: "s1", key, position, prompt: key, subtext: null, question_type: type, options, allow_unsure: false, required: true, depends_on_question_key: null, depends_on_values: null });
      db.questionnaire_templates = [{ id: TPL, event_type: "wedding_basics", title: "Wedding Basics", opening_heading: "x", opening_body: "x", opening_cta_label: "Go", is_active: true }];
      db.questionnaire_sections = [{ id: "s1", template_id: TPL, key: "all", title: "All", position: 1, transition_heading: null, transition_subheading: null }];
      db.questionnaire_questions = Object.keys(answers).map((k, i) => q(k, i, k === "coverage" || k.startsWith("best_") || k === "contact_methods" ? "multi_select" : "short_text", k === "contact_methods" ? [{ value: "text", label: "Text" }, { value: "call", label: "Phone call" }] : []));
      db.clients = [{ id: CL, first_name: "Caroline", last_name: "Catlin", phone: null, email: "caroline@bounced.example" }];
      db.events.push({ id: EV, dj_id: DJ_A, client_id: CL, starts_at: null, ends_at: null, timezone: "America/Chicago", venue_name: "Kyote's", expected_guests: null, couple_display_name: null, title: "Catlin wedding", event_category: "wedding" });
      const { applyWeddingBasics } = await import("@/lib/data/questionnaire-links");
      const { getTemplateForEventType } = await import("@/lib/data/questionnaires");
      const applied = await applyWeddingBasics((await import("@/lib/supabase/admin")).createAdminClient(), EV, answers, { template: await getTemplateForEventType("wedding_basics") });
      db.questionnaire_links = [{ id: randomUUID(), token: "caroline-catlin-abcdefghjk", event_id: EV, template_id: TPL, answers, completed_at: "2026-11-18T03:00:00Z", locked: true, applied, created_at: "2026-11-17T00:00:00Z", updated_at: "x", opened_at: "2026-11-17T01:00:00Z", revoked_at: null }];
      db.package_templates = [];
    });

    it("fills the partner, married name, contact choices and an after-midnight end time", () => {
      const ev = db.events.find((e) => e.id === EV)!;
      expect(ev.starts_at).toBe("2027-06-13T00:00:00.000Z"); // 7 PM CDT
      expect(ev.ends_at).toBe("2027-06-13T05:30:00.000Z"); // 12:30 AM the next morning
      expect(db.clients[0]).toMatchObject({ partner_first_name: "Josh", partner_last_name: "Reed", partner_phone: "(414) 555-0199", married_last_name: "Reed", contact_methods: ["text", "call"], best_days: ["tue", "sat"], best_times: ["evening"], email: "caroline@bounced.example" });
      const link = db.questionnaire_links[0] as { applied: { differs: { field: string; current: string; answered: string }[] } };
      expect(link.applied.differs).toEqual(expect.arrayContaining([{ field: "Venue", current: "Kyote's", answered: "The Grand Hall, Milwaukee" }, { field: "Client email", current: "caroline@bounced.example", answered: "caroline@example.com" }]));
    });

    it("the event's DJ sees answers and recommendations; another DJ can't; either can use an answer", async () => {
      const route = await import("@/app/api/events/[id]/wedding-basics/route");
      asB();
      expect((await route.GET(req(`/api/events/${EV}/wedding-basics`), p({ id: EV }))).status).toBe(403);
      asA();
      const got = await json(await route.GET(req(`/api/events/${EV}/wedding-basics`), p({ id: EV })));
      expect(got.status).toBe(200);
      expect(got.body.recommendations.addOns.map((a: { key: string }) => a.key)).toEqual(["speaker", "ceremony_sound", "mic", "mc"]);
      expect(got.body.recommendations.packages).toEqual([]);
      expect(got.body.link.answers.find((a: { prompt: string }) => a.prompt === "contact_methods").answer).toBe("Text, Phone call");
      // Use their answer for the email the CRM had wrong.
      const used = await json(await route.POST(req(`/api/events/${EV}/wedding-basics`, { method: "POST", body: { action: "use", field: "Client email" } }), p({ id: EV })));
      expect(used.status).toBe(200);
      expect(db.clients[0].email).toBe("caroline@example.com");
      expect(used.body.link.applied.differs.map((d: { field: string }) => d.field)).toEqual(["Venue"]);
      expect(used.body.link.applied.filled).toContain("Client email");
      // Only fields that actually differ can be changed this way.
      expect((await route.POST(req(`/api/events/${EV}/wedding-basics`, { method: "POST", body: { action: "use", field: "Guest count" } }), p({ id: EV }))).status).toBe(400);
    });
  });
});
