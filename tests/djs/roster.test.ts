import { describe, expect, it, vi, beforeEach } from "vitest";
import { inFilter, portalAccess } from "@/lib/dj/portal-access";

const NOW = Date.parse("2026-11-22T12:00:00Z");

describe("portal access", () => {
  it("no login: not connected, or setup link sent when a code is waiting", () => {
    expect(portalAccess({ auth_user_id: null }, null, false, NOW)).toBe("none");
    expect(portalAccess({ auth_user_id: null }, null, true, NOW)).toBe("setup_sent");
  });
  it("a linked login that works is portal active", () => {
    expect(portalAccess({ auth_user_id: "u1" }, { id: "u1", last_sign_in_at: "2026-11-01T00:00:00Z" }, false, NOW)).toBe("active");
    expect(portalAccess({ auth_user_id: "u1" }, { id: "u1", email_confirmed_at: "2026-11-01T00:00:00Z" }, false, NOW)).toBe("active");
  });
  it("an invite nobody accepted yet is invite sent, not active", () => {
    expect(portalAccess({ auth_user_id: "u1" }, { id: "u1", invited_at: "2026-11-20T00:00:00Z", last_sign_in_at: null, email_confirmed_at: null }, false, NOW)).toBe("invited");
  });
  it("blocked or missing logins are their own states", () => {
    expect(portalAccess({ auth_user_id: "u1" }, { id: "u1", last_sign_in_at: "2026-11-01T00:00:00Z", banned_until: "2027-01-01T00:00:00Z" }, false, NOW)).toBe("disabled");
    expect(portalAccess({ auth_user_id: "u1" }, { id: "u1", last_sign_in_at: "2026-11-01T00:00:00Z", banned_until: "2026-01-01T00:00:00Z" }, false, NOW)).toBe("active");
    expect(portalAccess({ auth_user_id: "u1" }, null, false, NOW)).toBe("missing");
  });
  it("filters cover every state exactly once (besides All)", () => {
    for (const a of ["active", "invited", "disabled", "missing", "setup_sent", "none"] as const) {
      expect((["active", "pending", "none"] as const).filter((f) => inFilter(a, f)).length, a).toBe(1);
      expect(inFilter(a, "all")).toBe(true);
    }
  });
});

let denied: Response | null = null;
vi.mock("@/lib/require-admin", () => ({ requireAdmin: async () => denied }));
const rows = [
  { id: "d1", display_name: "DJ Penny", auth_user_id: "u-penny", photo_url: null, hero_settings: null },
  { id: "d2", display_name: "DJ Que", auth_user_id: null, photo_url: null, hero_settings: null },
  { id: "d3", display_name: "DJ Rushie", auth_user_id: null, photo_url: null, hero_settings: null }
];
const writes: string[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    auth: { admin: { listUsers: async () => ({ data: { users: [{ id: "u-penny", last_sign_in_at: "2026-11-01T00:00:00Z" }] }, error: null }) } },
    from: (t: string) => {
      const q: Record<string, unknown> = {};
      for (const m of ["select", "eq", "not", "order"]) q[m] = () => q;
      for (const m of ["insert", "update", "upsert", "delete"]) q[m] = () => (writes.push(`${t}.${m}`), q);
      q.then = (r: (v: unknown) => void) => r(t === "djs" ? { data: rows, error: null } : { data: [{ assigned_dj_id: "d3" }], error: null });
      return q;
    }
  })
}));

import { GET } from "@/app/api/admin/djs/roster/route";

describe("roster API", () => {
  beforeEach(() => {
    denied = null;
    writes.length = 0;
  });
  it("is staff only", async () => {
    denied = new Response(JSON.stringify({ error: "Admins only" }), { status: 403 });
    expect((await GET()).status).toBe(403);
  });
  it("lists every DJ once with their real access state, and writes nothing", async () => {
    const res = await GET();
    const { djs } = await res.json();
    expect(djs.map((d: { id: string; access: string }) => [d.id, d.access])).toEqual([
      ["d1", "active"],
      ["d2", "none"],
      ["d3", "setup_sent"]
    ]);
    expect(writes).toEqual([]);
  });
});
