import { describe, expect, it } from "vitest";
import { verifyTurnstile, turnstileMessage } from "@/lib/security/turnstile";
import { safeNextPath } from "@/lib/security/safe-redirect";
import { cronAuthorized } from "@/lib/security/cron-auth";
import { accountRole, isSecurityAdminRole, isStaffRole } from "@/lib/roles";
import { normalizeEmail, maskEmail, randomToken } from "@/lib/security/crypto";
import { storagePathFromUrl, protectFileUrl } from "@/lib/security/protected-files";

const env = { TURNSTILE_SECRET_KEY: "test-secret-not-real" } as unknown as NodeJS.ProcessEnv;
const reply = (data: object, ok = true) => (async () => ({ ok, json: async () => data })) as unknown as typeof fetch;

describe("Turnstile server verification", () => {
  it("not configured → not_configured (never a silent pass)", async () => {
    expect(await verifyTurnstile({ token: "t", expectedAction: "inquiry", env: {} as NodeJS.ProcessEnv })).toEqual({ ok: false, reason: "not_configured" });
  });
  it("missing token", async () => {
    expect(await verifyTurnstile({ token: "", expectedAction: "inquiry", env })).toEqual({ ok: false, reason: "missing" });
  });
  it("invalid token", async () => {
    const r = await verifyTurnstile({ token: "t", expectedAction: "inquiry", env, fetchImpl: reply({ success: false, "error-codes": ["invalid-input-response"] }) });
    expect(r).toEqual({ ok: false, reason: "invalid" });
  });
  it("expired or already-used token", async () => {
    const r = await verifyTurnstile({ token: "t", expectedAction: "inquiry", env, fetchImpl: reply({ success: false, "error-codes": ["timeout-or-duplicate"] }) });
    expect(r).toEqual({ ok: false, reason: "expired_or_reused" });
  });
  it("token issued for another site is refused", async () => {
    const r = await verifyTurnstile({ token: "t", expectedAction: "inquiry", env, fetchImpl: reply({ success: true, hostname: "evil.example", action: "inquiry" }) });
    expect(r).toEqual({ ok: false, reason: "hostname" });
  });
  it("token issued for another form (action) is refused", async () => {
    const r = await verifyTurnstile({ token: "t", expectedAction: "inquiry", env, fetchImpl: reply({ success: true, hostname: "www.cratesdjs.com", action: "login" }) });
    expect(r).toEqual({ ok: false, reason: "action" });
  });
  it("network failure or Cloudflare error → unavailable", async () => {
    const boom = (async () => {
      throw new Error("ECONNRESET");
    }) as unknown as typeof fetch;
    expect(await verifyTurnstile({ token: "t", expectedAction: "inquiry", env, fetchImpl: boom })).toEqual({ ok: false, reason: "unavailable" });
    expect(await verifyTurnstile({ token: "t", expectedAction: "inquiry", env, fetchImpl: reply({}, false) })).toEqual({ ok: false, reason: "unavailable" });
  });
  it("valid token passes and the secret is sent only to Cloudflare", async () => {
    let calledUrl = "";
    const f = (async (url: string) => {
      calledUrl = url;
      return { ok: true, json: async () => ({ success: true, hostname: "www.cratesdjs.com", action: "inquiry" }) };
    }) as unknown as typeof fetch;
    expect(await verifyTurnstile({ token: "t", expectedAction: "inquiry", env, fetchImpl: f })).toEqual({ ok: true });
    expect(calledUrl).toBe("https://challenges.cloudflare.com/turnstile/v0/siteverify");
  });
  it("visitor messages never expose the internal reason", () => {
    for (const r of ["invalid", "hostname", "action"] as const) expect(turnstileMessage(r)).not.toMatch(/hostname|action|secret/i);
  });
});

describe("safe post-login redirects", () => {
  it.each([
    ["https://evil.example/phish", "/fallback"],
    ["//evil.example", "/fallback"],
    ["/\\evil.example", "/fallback"],
    ["%2F%2Fevil.example", "/fallback"],
    ["javascript:alert(1)", "/fallback"],
    ["/javascript:alert(1)", "/fallback"],
    ["/admin/events?tab=1", "/admin/events?tab=1"],
    [null, "/fallback"]
  ])("%s → %s", (input, out) => {
    expect(safeNextPath(input as string | null, "/fallback")).toBe(out);
  });
  it("portal redirects stay inside the portal", () => {
    expect(safeNextPath("/admin", "/portal", ["/portal"])).toBe("/portal");
    expect(safeNextPath("/portal/events/1", "/portal", ["/portal"])).toBe("/portal/events/1");
    expect(safeNextPath("/portalx", "/portal", ["/portal"])).toBe("/portal");
  });
});

describe("cron endpoints", () => {
  it("refuse everything when CRON_SECRET is unset (fixes the 'Bearer undefined' bypass)", () => {
    expect(cronAuthorized("Bearer undefined", undefined)).toBe(false);
    expect(cronAuthorized("Bearer ", "")).toBe(false);
  });
  it("refuse weak secrets and wrong headers; accept the right one", () => {
    expect(cronAuthorized("Bearer short", "short")).toBe(false);
    const s = "a-long-random-test-value-123";
    expect(cronAuthorized(`Bearer ${s}x`, s)).toBe(false);
    expect(cronAuthorized(null, s)).toBe(false);
    expect(cronAuthorized(`Bearer ${s}`, s)).toBe(true);
  });
});

describe("roles come only from server-controlled app_metadata", () => {
  it("a user who sets user_metadata.role = admin is not an admin", () => {
    const forged = { app_metadata: {}, user_metadata: { role: "owner" } };
    expect(accountRole(forged)).toBeUndefined();
    expect(isStaffRole(accountRole(forged))).toBe(false);
    expect(isSecurityAdminRole(accountRole(forged))).toBe(false);
  });
  it("security actions are owner/admin only; managers and DJs are staff but not security admins", () => {
    expect(isSecurityAdminRole("owner")).toBe(true);
    expect(isSecurityAdminRole("admin")).toBe(true);
    expect(isSecurityAdminRole("manager")).toBe(false);
    expect(isSecurityAdminRole("dj")).toBe(false);
  });
});

describe("helpers", () => {
  it("normalizes gmail dots and +tags for duplicate detection only", () => {
    expect(normalizeEmail("Jordan.Lee+Wedding@GMAIL.com")).toBe("jordanlee@gmail.com");
    expect(normalizeEmail("first.last+x@company.com")).toBe("first.last@company.com");
  });
  it("masks emails for logs", () => {
    expect(maskEmail("jordan@example.com")).not.toContain("jordan");
  });
  it("tokens are 256-bit and unique", () => {
    const a = randomToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(randomToken()).not.toBe(a);
  });
  it("private files are served through the authorized route, not their storage URL", () => {
    const url = "https://abc.supabase.co/storage/v1/object/public/event-files/ev1/contract.pdf";
    expect(storagePathFromUrl(url)).toBe("ev1/contract.pdf");
    expect(protectFileUrl("contract", "11111111-1111-1111-1111-111111111111", url)).toBe("/api/files/contract/11111111-1111-1111-1111-111111111111");
  });
});
