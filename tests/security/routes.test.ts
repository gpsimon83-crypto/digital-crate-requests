import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

// ---- Shared fakes for Supabase (session client + service-role client) ----
const session = {
  user: null as null | { id: string; email?: string; app_metadata: Record<string, unknown>; user_metadata?: Record<string, unknown> },
  aal: { currentLevel: "aal1", nextLevel: "aal1" } as { currentLevel: string; nextLevel: string }
};
const db = {
  event_files: [{ id: "11111111-1111-1111-1111-111111111111", event_id: "ev-A", file_url: "https://x.supabase.co/storage/v1/object/public/event-files/ev-A/contract.pdf" }],
  contracts: [] as { id: string; event_id: string; file_url: string }[],
  djs: [{ id: "dj-A", auth_user_id: "u-dj-A" }, { id: "dj-B", auth_user_id: "u-dj-B" }],
  events: [{ id: "ev-A", dj_id: "dj-A", client_id: "client-A", event_code: "WED-2026", title: "Lee Wedding", status: "confirmed" }],
  clients: [{ id: "client-A", auth_user_id: "u-client-A" }, { id: "client-B", auth_user_id: "u-client-B" }]
};

function table(name: keyof typeof db) {
  const filters: [string, unknown][] = [];
  const q = {
    select: () => q,
    eq: (k: string, v: unknown) => {
      filters.push([k, v]);
      return q;
    },
    maybeSingle: async () => ({ data: (db[name] as Record<string, unknown>[]).find((r) => filters.every(([k, v]) => r[k] === v)) ?? null, error: null })
  };
  return q;
}

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: session.user } }),
      mfa: { getAuthenticatorAssuranceLevel: async () => ({ data: session.aal, error: null }) }
    }
  })
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (n: keyof typeof db) => table(n),
    storage: { from: () => ({ createSignedUrl: async (p: string, s: number) => ({ data: { signedUrl: `https://signed.example/${p}?ttl=${s}` }, error: null }) }) }
  })
}));
vi.mock("@/lib/data/portal", () => ({
  getClientForAuthUser: async (uid: string) => db.clients.find((c) => c.auth_user_id === uid) ?? null,
  getClientEvent: async (cid: string, eid: string) => db.events.find((e) => e.id === eid && e.client_id === cid) ?? null
}));
vi.mock("@/lib/data/requests", () => ({
  getEventByCode: async (code: string) => ({ ...db.events.find((e) => e.event_code === code), client_email: "private@example.com", price_cents: 250000 })
}));

const as = (id: string | null, role?: string) => {
  session.user = id ? { id, email: `${id}@example.com`, app_metadata: role ? { role } : {} } : null;
};

beforeEach(() => {
  session.aal = { currentLevel: "aal1", nextLevel: "aal1" };
  delete process.env.ADMIN_MFA_REQUIRED;
});

describe("private files: only the owner, assigned DJ or staff", async () => {
  const { GET } = await import("@/app/api/files/[kind]/[id]/route");
  const call = () => GET(new NextRequest("https://www.cratesdjs.com/api/files/event-file/11111111-1111-1111-1111-111111111111"), { params: Promise.resolve({ kind: "event-file", id: "11111111-1111-1111-1111-111111111111" }) });

  it("signed-out visitors get 401", async () => {
    as(null);
    expect((await call()).status).toBe(401);
  });
  it("another client gets 404 (not even confirmation the file exists)", async () => {
    as("u-client-B");
    expect((await call()).status).toBe(404);
  });
  it("a different DJ gets 404", async () => {
    as("u-dj-B", "dj");
    expect((await call()).status).toBe(404);
  });
  it("the client who owns the event gets a short-lived signed link, never cached", async () => {
    as("u-client-A");
    const r = await call();
    expect(r.status).toBe(302);
    expect(r.headers.get("location")).toBe("https://signed.example/ev-A/contract.pdf?ttl=120");
    expect(r.headers.get("cache-control")).toContain("no-store");
  });
  it("the assigned DJ and staff can open it", async () => {
    as("u-dj-A", "dj");
    expect((await call()).status).toBe(302);
    as("u-staff", "admin");
    expect((await call()).status).toBe(302);
  });
  it("staff whose two-factor isn't verified this session lose staff access", async () => {
    as("u-staff", "admin");
    session.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    expect((await call()).status).toBe(404);
  });
  it("forged user_metadata role doesn't grant access", async () => {
    session.user = { id: "u-client-B", app_metadata: {}, user_metadata: { role: "owner" } };
    expect((await call()).status).toBe(404);
  });
});

describe("event lookup by code", async () => {
  const { GET } = await import("@/app/api/events/code/[code]/route");
  const call = async () => (await GET(new NextRequest("https://www.cratesdjs.com/api/events/code/WED-2026"), { params: Promise.resolve({ code: "WED-2026" }) })).json();

  it("guests get the public view only", async () => {
    as(null);
    const { event } = await call();
    expect(event.title).toBe("Lee Wedding");
    // The table fake returns whole rows; the route asks for public columns only, so check the full-record path wasn't used.
    expect(event.client_email).toBeUndefined();
  });
  it("another DJ gets the public view, the assigned DJ gets the full record", async () => {
    as("u-dj-B", "dj");
    expect((await call()).event.client_email).toBeUndefined();
    as("u-dj-A", "dj");
    expect((await call()).event.client_email).toBe("private@example.com");
  });
});

describe("admin-only security actions", async () => {
  const { POST } = await import("@/app/api/admin/security/actions/route");
  const call = () =>
    POST(new NextRequest("https://www.cratesdjs.com/api/admin/security/actions", { method: "POST", body: JSON.stringify({ action: "spam", id: "11111111-1111-1111-1111-111111111111" }) }));

  it("signed out → 401; DJ or manager → 403; forged user_metadata → 403", async () => {
    as(null);
    expect((await call()).status).toBe(401);
    as("u-dj-A", "dj");
    expect((await call()).status).toBe(403);
    as("u-mgr", "manager");
    expect((await call()).status).toBe(403);
    session.user = { id: "u-x", app_metadata: {}, user_metadata: { role: "owner" } };
    expect((await call()).status).toBe(403);
  });
  it("owner with two-factor set up but not verified this session → 403 mfa", async () => {
    as("u-owner", "owner");
    session.aal = { currentLevel: "aal1", nextLevel: "aal2" };
    const r = await call();
    expect(r.status).toBe(403);
    expect((await r.json()).mfa).toBe(true);
  });
  it("ADMIN_MFA_REQUIRED=true blocks owners who haven't set up two-factor", async () => {
    process.env.ADMIN_MFA_REQUIRED = "true";
    as("u-owner", "owner");
    expect((await call()).status).toBe(403);
  });
});

describe("CSRF origin check on API mutations", async () => {
  const { middleware } = await import("@/middleware");
  const req = (method: string, origin?: string) =>
    new NextRequest("https://www.cratesdjs.com/api/portal/me", { method, headers: origin ? { origin } : {} });

  it("blocks a cross-site POST", async () => {
    expect((await middleware(req("POST", "https://evil.example"))).status).toBe(403);
  });
  it("allows same-site POSTs, server-to-server calls (no Origin) and GETs", async () => {
    expect((await middleware(req("POST", "https://www.cratesdjs.com"))).status).toBe(200);
    expect((await middleware(req("POST"))).status).toBe(200);
    expect((await middleware(req("GET", "https://evil.example"))).status).toBe(200);
  });
});

describe("Stripe webhook signature", async () => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_placeholder_for_tests");
  const { POST } = await import("@/app/api/stripe/webhook/route");
  it("unsigned or forged events are rejected before anything is recorded", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_placeholder_for_tests");
    const r = await POST(new NextRequest("https://www.cratesdjs.com/api/stripe/webhook", { method: "POST", body: JSON.stringify({ id: "evt_fake", type: "payment_intent.succeeded" }), headers: { "stripe-signature": "t=1,v1=forged" } }));
    expect(r.status).toBe(400);
  });
  it("refuses to run at all without a webhook secret", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const r = await POST(new NextRequest("https://www.cratesdjs.com/api/stripe/webhook", { method: "POST", body: "{}" }));
    expect(r.status).toBe(500);
  });
});
