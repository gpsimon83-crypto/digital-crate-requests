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
    gte: (k: string, v: string) => (filters.push((r) => String(r[k] ?? "") >= v), q),
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
  it("profile photos are only served to that DJ and staff", async () => {
    const { GET } = await import("@/app/api/flyers/photo/[djId]/route");
    asA();
    expect((await GET(req(`/api/flyers/photo/${DJ_B}`), p({ djId: DJ_B }))).status).toBe(404);
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
