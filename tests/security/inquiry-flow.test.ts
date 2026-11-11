import { describe, expect, it } from "vitest";
import { submitPublicRequest, verifySubmissionToken, resendVerification } from "@/lib/security/inquiry-service";
import { PAST_DATE_MESSAGE } from "@/lib/security/business-date";
import { sha256Hex } from "@/lib/security/crypto";
import { makeDeps, tokenFromLink, validInquiry } from "./helpers";

const ctx = { ip: "203.0.113.7", partner: false };

describe("Turnstile on the inquiry form", () => {
  it("missing token: rejected, nothing saved, no email", async () => {
    const { deps, repo, mail } = makeDeps();
    const r = await submitPublicRequest("inquiry", validInquiry({ turnstileToken: undefined }), ctx, deps);
    expect(r.status).toBe(400);
    expect(r.body.retryCaptcha).toBe(true);
    expect(repo.rows).toHaveLength(0);
    expect(mail).toHaveLength(0);
  });

  it("invalid token: rejected", async () => {
    const { deps, repo } = makeDeps();
    const r = await submitPublicRequest("inquiry", validInquiry({ turnstileToken: "forged" }), ctx, deps);
    expect(r.status).toBe(400);
    expect(repo.rows).toHaveLength(0);
  });

  it("expired or reused token: rejected with a retry message", async () => {
    const { deps } = makeDeps({ captcha: { ok: false, reason: "expired_or_reused" } });
    const r = await submitPublicRequest("inquiry", validInquiry(), ctx, deps);
    expect(r.status).toBe(400);
    expect(String(r.body.error)).toMatch(/expired/i);
  });

  it("service outage: 503 with a clear retry message (no fake pass)", async () => {
    const { deps, repo } = makeDeps({ captcha: { ok: false, reason: "unavailable" } });
    const r = await submitPublicRequest("inquiry", validInquiry(), ctx, deps);
    expect(r.status).toBe(503);
    expect(String(r.body.error)).toMatch(/try again/i);
    expect(repo.rows).toHaveLength(0);
  });

  it("not configured: refused, not treated as passed", async () => {
    const { deps, repo } = makeDeps({ captcha: { ok: false, reason: "not_configured" } });
    const r = await submitPublicRequest("inquiry", validInquiry(), ctx, deps);
    expect(r.status).toBe(503);
    expect(repo.rows).toHaveLength(0);
  });

  it("the WordPress partner path skips Turnstile (authenticated by shared secret) but nothing else", async () => {
    const { deps, repo, captchaCalls } = makeDeps();
    const r = await submitPublicRequest("inquiry", validInquiry({ turnstileToken: undefined }), { ip: "198.51.100.4", partner: true }, deps);
    expect(r.status).toBe(200);
    expect(captchaCalls).toHaveLength(0);
    expect(repo.rows[0].source).toBe("wordpress");
    expect(repo.rows[0].status).toBe("pending_verification");
  });
});

describe("validation", () => {
  it("past date: rejected before saving, emailing or checking anything else", async () => {
    const { deps, repo, mail, captchaCalls } = makeDeps();
    const r = await submitPublicRequest("inquiry", validInquiry({ eventDate: "2026-11-10" }), ctx, deps);
    expect(r.status).toBe(400);
    expect(r.body.error).toBe(PAST_DATE_MESSAGE);
    expect(repo.rows).toHaveLength(0);
    expect(mail).toHaveLength(0);
    expect(captchaCalls).toHaveLength(0);
  });

  it("today is accepted", async () => {
    const { deps } = makeDeps();
    const r = await submitPublicRequest("inquiry", validInquiry({ eventDate: "2026-11-11" }), ctx, deps);
    expect(r.status).toBe(200);
  });

  it("rejects unexpected fields (e.g. trying to set a status)", async () => {
    const { deps, repo } = makeDeps();
    const r = await submitPublicRequest("inquiry", { ...validInquiry(), status: "confirmed" }, ctx, deps);
    expect(r.status).toBe(400);
    expect(repo.rows).toHaveLength(0);
  });

  it("rejects event types outside the list and bad emails", async () => {
    const { deps } = makeDeps();
    expect((await submitPublicRequest("inquiry", validInquiry({ eventType: "Rave" }), ctx, deps)).status).toBe(400);
    expect((await submitPublicRequest("inquiry", validInquiry({ email: "not-an-email" }), ctx, deps)).status).toBe(400);
    expect((await submitPublicRequest("inquiry", validInquiry({ message: "x".repeat(3001) }), ctx, deps)).status).toBe(400);
  });
});

describe("rate limits", () => {
  it("5 inquiries per source per 15 minutes; the 6th gets a retry message", async () => {
    const { deps } = makeDeps();
    for (let i = 0; i < 5; i++) {
      const r = await submitPublicRequest("inquiry", validInquiry({ email: `p${i}@example.com` }), ctx, deps);
      expect(r.status).toBe(200);
    }
    const sixth = await submitPublicRequest("inquiry", validInquiry({ email: "p6@example.com" }), ctx, deps);
    expect(sixth.status).toBe(429);
    expect(String(sixth.body.error)).toMatch(/wait about \d+ minute/);
    // A different visitor isn't affected.
    expect((await submitPublicRequest("inquiry", validInquiry({ email: "other@example.com" }), { ip: "203.0.113.99", partner: false }, deps)).status).toBe(200);
  });

  it("the window resets (no permanent ban)", async () => {
    const { deps, clock } = makeDeps();
    for (let i = 0; i < 6; i++) await submitPublicRequest("inquiry", validInquiry({ email: `q${i}@example.com` }), ctx, deps);
    clock.t = new Date(clock.t.getTime() + 16 * 60 * 1000);
    expect((await submitPublicRequest("inquiry", validInquiry({ email: "later@example.com" }), ctx, deps)).status).toBe(200);
  });

  it("verification emails: 3 per address per hour", async () => {
    const { deps, mail } = makeDeps();
    await submitPublicRequest("inquiry", validInquiry({ email: "limit@example.com" }), ctx, deps);
    for (let i = 0; i < 4; i++) {
      await resendVerification({ email: "limit@example.com", turnstileToken: "good-token" }, { ip: `198.51.100.${i + 10}`, partner: false }, deps);
    }
    expect(mail.filter((m) => m.to === "limit@example.com")).toHaveLength(3);
  });
});

describe("pending → verified → lead", () => {
  it("a new inquiry is saved as pending and nothing is activated until the email is confirmed", async () => {
    const { deps, repo, mail, activated } = makeDeps();
    const r = await submitPublicRequest("inquiry", validInquiry(), ctx, deps);
    expect(r.status).toBe(200);
    expect(r.body.next).toBe("check_email");
    expect(repo.rows[0].status).toBe("pending_verification");
    expect(repo.rows[0].event_id).toBeNull();
    expect(activated).toHaveLength(0);
    expect(mail).toHaveLength(1);
    // Only a hash of the token is stored; the link carries no personal data.
    const token = tokenFromLink(mail[0].link);
    expect(repo.rows[0].verification_token_hash).toBe(sha256Hex(token));
    expect(mail[0].link).not.toContain("jordan");
    expect(mail[0].link).toMatch(/^https:\/\/www\.cratesdjs\.com\/inquiry\/verify#t=[A-Za-z0-9_-]{43}$/);
  });

  it("verifying activates the lead exactly once; reusing the link does nothing more", async () => {
    const { deps, repo, mail, activated } = makeDeps();
    await submitPublicRequest("inquiry", validInquiry(), ctx, deps);
    const token = tokenFromLink(mail[0].link);
    const first = await verifySubmissionToken(token, ctx, deps);
    expect(first.outcome).toBe("verified");
    expect(repo.rows[0].status).toBe("verified");
    expect(repo.rows[0].event_id).toBe(`event-${repo.rows[0].id}`);
    const again = await verifySubmissionToken(token, ctx, deps);
    expect(again.outcome).toBe("already");
    expect(activated).toHaveLength(1);
  });

  it("two simultaneous clicks still create one lead", async () => {
    const { deps, mail, activated } = makeDeps();
    await submitPublicRequest("inquiry", validInquiry(), ctx, deps);
    const token = tokenFromLink(mail[0].link);
    const [a, b] = await Promise.all([verifySubmissionToken(token, ctx, deps), verifySubmissionToken(token, ctx, deps)]);
    expect([a.outcome, b.outcome].sort()).toEqual(["already", "verified"]);
    expect(activated).toHaveLength(1);
  });

  it("expired link: 410 expired, no activation; resend issues a new working link", async () => {
    const { deps, mail, activated, clock } = makeDeps();
    await submitPublicRequest("inquiry", validInquiry({ email: "late@example.com" }), ctx, deps);
    clock.t = new Date(clock.t.getTime() + 25 * 3600 * 1000);
    const r = await verifySubmissionToken(tokenFromLink(mail[0].link), ctx, deps);
    expect(r.status).toBe(410);
    expect(r.outcome).toBe("expired");
    expect(activated).toHaveLength(0);

    const resend = await resendVerification({ email: "late@example.com", turnstileToken: "good-token" }, ctx, deps);
    expect(resend.status).toBe(200);
    expect(mail).toHaveLength(2);
    expect((await verifySubmissionToken(tokenFromLink(mail[0].link), ctx, deps)).outcome).toBe("invalid"); // old link replaced
    expect((await verifySubmissionToken(tokenFromLink(mail[1].link), ctx, deps)).outcome).toBe("verified");
  });

  it("tampered or random tokens are invalid", async () => {
    const { deps } = makeDeps();
    expect((await verifySubmissionToken("x".repeat(43), ctx, deps)).outcome).toBe("invalid");
    expect((await verifySubmissionToken("<script>", ctx, deps)).outcome).toBe("invalid");
    expect((await verifySubmissionToken(undefined, ctx, deps)).outcome).toBe("invalid");
  });

  it("if the event date passes before the email is confirmed, nothing is activated", async () => {
    const { deps, repo, mail, activated, clock } = makeDeps();
    await submitPublicRequest("inquiry", validInquiry({ eventDate: "2026-11-11" }), ctx, deps);
    clock.t = new Date("2026-11-12T06:30:00Z"); // 12:30 AM next day in Chicago, link still valid
    const r = await verifySubmissionToken(tokenFromLink(mail[0].link), ctx, deps);
    expect(r.outcome).toBe("date_passed");
    expect(repo.rows[0].status).toBe("archived");
    expect(activated).toHaveLength(0);
  });

  it("resend gives the same neutral answer for unknown addresses", async () => {
    const { deps, mail } = makeDeps();
    const r = await resendVerification({ email: "nobody@example.com", turnstileToken: "good-token" }, ctx, deps);
    expect(r.status).toBe(200);
    expect(String(r.body.message)).toMatch(/If there's a request waiting/);
    expect(mail).toHaveLength(0);
  });
});

describe("duplicates and spam", () => {
  it("retrying the same form submission (same submissionId) creates one inquiry", async () => {
    const { deps, repo } = makeDeps();
    const body = validInquiry();
    const a = await submitPublicRequest("inquiry", body, ctx, deps);
    const b = await submitPublicRequest("inquiry", body, ctx, deps);
    expect(a.body).toEqual(b.body);
    expect(repo.rows).toHaveLength(1);
  });

  it("the same person re-sending the same request (new form fill) is one inquiry, not two", async () => {
    const { deps, repo } = makeDeps();
    await submitPublicRequest("inquiry", validInquiry({ email: "Jordan.Lee+wedding@gmail.com" }), ctx, deps);
    await submitPublicRequest("inquiry", validInquiry({ email: "jordanlee@gmail.com" }), ctx, deps);
    expect(repo.rows).toHaveLength(1);
    expect(repo.events.some((e) => e.action === "duplicate_ignored")).toBe(true);
  });

  it("honeypot: saved as spam, no email, same neutral response as a real request", async () => {
    const { deps, repo, mail } = makeDeps();
    const real = await submitPublicRequest("inquiry", validInquiry({ email: "real@example.com" }), { ip: "203.0.113.1", partner: false }, deps);
    const bot = await submitPublicRequest("inquiry", validInquiry({ email: "bot@example.com", website: "http://spam.example" }), { ip: "203.0.113.2", partner: false }, deps);
    expect(bot.status).toBe(200);
    expect(bot.body).toEqual(real.body);
    const row = repo.rows.find((r) => r.email === "bot@example.com")!;
    expect(row.status).toBe("spam");
    expect(mail.map((m) => m.to)).toEqual(["real@example.com"]);
  });

  it("fast completion alone does not reject or flag a real client", async () => {
    const { deps, repo } = makeDeps();
    const r = await submitPublicRequest("inquiry", validInquiry({ elapsedMs: 1500 }), ctx, deps);
    expect(r.status).toBe(200);
    expect(repo.rows[0].status).toBe("pending_verification");
    expect(repo.rows[0].risk_reasons).toContain("Form was completed in under 3 seconds");
  });

  it("free email providers are never a signal", async () => {
    const { deps, repo } = makeDeps();
    for (const [i, e] of ["a@gmail.com", "b@yahoo.com", "c@outlook.com"].entries()) {
      await submitPublicRequest("inquiry", validInquiry({ email: e, message: `Reception number ${["one", "two", "three"][i]}, family party with old school soul.` }), { ip: `198.${51 + i}.100.7`, partner: false }, deps);
    }
    expect(repo.rows.map((r) => [r.status, r.risk_reasons])).toEqual(repo.rows.map(() => ["pending_verification", []]));
  });

  it("the same message from several addresses goes to review with an understandable reason", async () => {
    const { deps, repo } = makeDeps();
    const msg = "Cheap SEO services for your DJ website, visit our page today for a discount offer!";
    for (let i = 0; i < 3; i++) await submitPublicRequest("inquiry", validInquiry({ email: `seo${i}@example.com`, message: msg }), { ip: `192.0.2.${50 + i}`, partner: false }, deps);
    const last = repo.rows[2];
    expect(last.status).toBe("needs_review");
    expect(last.risk_reasons.join(" ")).toMatch(/Same message text was sent from 2 other email addresses/);
  });

  it("a flagged inquiry still gets its confirmation email but is not activated on verification", async () => {
    const { deps, repo, mail, activated } = makeDeps();
    repo.blocks = [];
    await submitPublicRequest("inquiry", validInquiry({ email: "flag@mailinator.com", message: "see www.a.com www.b.com www.c.com" }), ctx, deps);
    expect(repo.rows[0].status).toBe("needs_review");
    const r = await verifySubmissionToken(tokenFromLink(mail[0].link), ctx, deps);
    expect(r.outcome).toBe("received");
    expect(repo.rows[0].status).toBe("needs_review");
    expect(activated).toHaveLength(0);
  });
});

describe("consultation calls", () => {
  const slot = async () => ({ ok: true as const, start: new Date("2026-11-13T16:00:00Z"), end: new Date("2026-11-13T16:15:00Z") });

  it("holds the slot while waiting for email confirmation; a second request for it is refused", async () => {
    const { deps, repo } = makeDeps();
    deps.slotAvailable = slot;
    const body = { name: "Sam Rivera", email: "sam@example.com", date: "2026-11-13", time: "10:00", turnstileToken: "good-token" };
    expect((await submitPublicRequest("consultation", body, ctx, deps)).status).toBe(200);
    expect(repo.holds.size).toBe(1);
    const other = await submitPublicRequest("consultation", { ...body, email: "other@example.com" }, { ip: "192.0.2.200", partner: false }, deps);
    expect(other.status).toBe(409);
  });

  it("past dates are refused for calls too", async () => {
    const { deps } = makeDeps();
    deps.slotAvailable = slot;
    const r = await submitPublicRequest("consultation", { name: "Sam Rivera", email: "sam@example.com", date: "2026-11-10", time: "10:00", turnstileToken: "good-token" }, ctx, deps);
    expect(r.status).toBe(400);
    expect(r.body.error).toBe(PAST_DATE_MESSAGE);
  });
});
