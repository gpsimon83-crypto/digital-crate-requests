import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (n: string) => (n === "dcdj_view_as" && cookieValue ? { value: cookieValue } : undefined) })
}));

import { djRowForUser, viewAsDjId, viewAsDjIdFor } from "@/lib/view-as";
import { middleware } from "@/middleware";

const PENNY = "11111111-2222-4333-8444-555555555555";
const PEACE = "99999999-2222-4333-8444-555555555555";

/** A tiny stand-in for the Supabase admin client: one djs table and two accounts. */
function fakeDb(roles: Record<string, string>) {
  const djs = [
    { id: PENNY, display_name: "DJ Penny", auth_user_id: "u-penny" },
    { id: PEACE, display_name: "DJ Peace", auth_user_id: "u-admin" }
  ];
  return {
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: { id, app_metadata: { role: roles[id] } } } }) } },
    from: () => ({
      select: () => ({
        eq: (col: "id" | "auth_user_id", v: string) => ({ maybeSingle: async () => ({ data: djs.find((d) => d[col] === v) ?? null }) })
      })
    })
  } as never;
}
const db = fakeDb({ "u-admin": "admin", "u-penny": "dj" });

describe("View as DJ", () => {
  beforeEach(() => {
    cookieValue = undefined;
  });

  it("without the cookie, everyone is themselves", async () => {
    expect(await djRowForUser(db, "u-admin", "id, display_name")).toMatchObject({ display_name: "DJ Peace" });
    expect(await djRowForUser(db, "u-penny", "id, display_name")).toMatchObject({ display_name: "DJ Penny" });
  });

  it("staff with the cookie act as the viewed DJ", async () => {
    cookieValue = PENNY;
    expect(await viewAsDjIdFor(db, "u-admin")).toBe(PENNY);
    expect(await djRowForUser(db, "u-admin", "id, display_name")).toMatchObject({ display_name: "DJ Penny" });
    expect(await viewAsDjId(db, { id: "u-admin", app_metadata: { role: "admin" } })).toBe(PENNY);
  });

  it("a DJ who sets the cookie themselves gets nothing from it", async () => {
    cookieValue = PEACE;
    expect(await viewAsDjIdFor(db, "u-penny")).toBeNull();
    expect(await djRowForUser(db, "u-penny", "id, display_name")).toMatchObject({ display_name: "DJ Penny" });
    // Even if their session claims staff, the account itself is checked.
    expect(await viewAsDjId(db, { id: "u-penny", app_metadata: { role: "dj" } })).toBeNull();
  });

  it("ignores a cookie that isn't a DJ id", async () => {
    cookieValue = "not-a-uuid";
    expect(await viewAsDjIdFor(db, "u-admin")).toBeNull();
  });

  const req = (method: string, path: string, viewing: boolean) =>
    new NextRequest(`https://cratesdjs.com${path}`, { method, headers: { origin: "https://cratesdjs.com", ...(viewing ? { cookie: `dcdj_view_as=${PENNY}` } : {}) } });

  it("is read-only: every change is refused while viewing", async () => {
    for (const [m, p] of [["POST", "/api/flyers/designs"], ["PATCH", "/api/dj/profile"], ["DELETE", "/api/events/x/files/y"], ["POST", "/api/admin/events"]]) {
      const res = await middleware(req(m, p, true));
      expect(res.status, `${m} ${p}`).toBe(403);
      expect((await res.json()).viewAs).toBe(true);
    }
    // Reading works, and so does turning it off.
    expect((await middleware(req("GET", "/api/dj/profile", true))).status).toBe(200);
    expect((await middleware(req("DELETE", "/api/admin/view-as", true))).status).toBe(200);
    // Not viewing: changes go through as before.
    expect((await middleware(req("POST", "/api/flyers/designs", false))).status).toBe(200);
  });

  it("opening an admin page switches it off", async () => {
    const res = await middleware(req("GET", "/admin/djs", true));
    expect(res.status).toBe(307);
    expect(res.headers.get("set-cookie")).toMatch(/dcdj_view_as=;/);
  });
});
