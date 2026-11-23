import { describe, expect, it, vi, beforeEach } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import { DJ_NAV_GROUPS, DJ_TAB_ITEMS, MY_GIGS_PATHS } from "@/lib/dj-nav";
import { ADMIN_NAV_GROUPS } from "@/lib/admin-nav";
import { ACADEMY_URL, AVAILABILITY_URL, MEMBERS_AREA } from "@/lib/external-links";

/** Does an app route exist for this path (ignoring ?query)? */
const pageExists = (href: string) => existsSync(path.join(process.cwd(), "src/app", href.split("?")[0], "page.tsx"));

describe("menus only link to pages that exist", () => {
  it("DJ menu: every item is a real page or a known members-area page", () => {
    for (const g of DJ_NAV_GROUPS)
      for (const it of g.items) {
        if (it.external) expect([ACADEMY_URL, AVAILABILITY_URL, MEMBERS_AREA], it.label).toContain(it.href);
        else expect(pageExists(it.href), `${it.label} → ${it.href}`).toBe(true);
      }
    for (const it of DJ_TAB_ITEMS) expect(pageExists(it.href), it.href).toBe(true);
    for (const p of MY_GIGS_PATHS) expect(pageExists(p), p).toBe(true);
  });

  it("DJ menu has the agreed groups in order", () => {
    expect(DJ_NAV_GROUPS.map((g) => g.label)).toEqual(["Overview", "My work", "Resources", "Account"]);
    expect(DJ_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.label))).toEqual([
      "Home",
      "Notifications",
      "My Gigs",
      "Calendar & Availability",
      "Tasks & Planning",
      "Messages",
      "Meetings",
      "Music & Crates",
      "Flyer Creator",
      "DCDJs Academy",
      "Documents & Library",
      "My Earnings",
      "My Profile",
      "Services & Pricing"
    ]);
  });

  it("DJ menu never links to admin pages", () => {
    for (const g of DJ_NAV_GROUPS) for (const it of g.items) expect(it.href.startsWith("/admin"), it.href).toBe(false);
  });

  it("Admin menu: every item is a real page, with no duplicate destinations", () => {
    const hrefs = ADMIN_NAV_GROUPS.flatMap((g) => g.items.map((i) => i.href));
    expect(new Set(hrefs).size).toBe(hrefs.length);
    for (const g of ADMIN_NAV_GROUPS)
      for (const it of g.items) {
        if (it.external) expect([ACADEMY_URL, MEMBERS_AREA], it.label).toContain(it.href);
        else expect(pageExists(it.href), `${it.label} → ${it.href}`).toBe(true);
      }
  });

  it("the Academy and availability links are the members-area pages already used elsewhere", () => {
    expect(ACADEMY_URL).toBe("https://digitalcratedjs.com/members/#academy");
    expect(AVAILABILITY_URL).toBe("https://digitalcratedjs.com/members/#availability");
  });
});

/* ---- Admin View / DJ View switch ---- */

let session: { id: string; app_metadata: { role: string } } | null = null;
let djLinked = true;
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: session } }) } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({}) }));
vi.mock("@/lib/view-as", () => ({ djRowForUser: async () => (djLinked ? { id: "dj-peace" } : null) }));

import { POST } from "@/app/api/me/view-mode/route";
const req = (mode: string) => new Request("http://x/api/me/view-mode", { method: "POST", body: JSON.stringify({ mode }) });

describe("view switch", () => {
  beforeEach(() => {
    session = null;
    djLinked = true;
  });
  it("needs a login", async () => {
    expect((await POST(req("dj"))).status).toBe(401);
  });
  it("an ordinary DJ can't turn on the staff switch", async () => {
    session = { id: "u-penny", app_metadata: { role: "dj" } };
    const res = await POST(req("dj"));
    expect(res.status).toBe(403);
    expect(res.headers.get("set-cookie") ?? "").not.toMatch(/dcdj_view_mode=dj/);
  });
  it("staff need a linked DJ profile", async () => {
    session = { id: "u-admin", app_metadata: { role: "admin" } };
    djLinked = false;
    expect((await POST(req("dj"))).status).toBe(409);
  });
  it("staff with their own DJ profile get DJ View, and can switch back", async () => {
    session = { id: "u-admin", app_metadata: { role: "admin" } };
    const on = await POST(req("dj"));
    expect(on.status).toBe(200);
    expect(on.headers.get("set-cookie")).toMatch(/dcdj_view_mode=dj/);
    const off = await POST(req("admin"));
    expect(off.status).toBe(200);
    expect(off.headers.get("set-cookie")).toMatch(/dcdj_view_mode=;|Max-Age=0|Expires=Thu, 01 Jan 1970/);
  });
});
