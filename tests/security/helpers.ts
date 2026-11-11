import { randomUUID } from "crypto";
import type { Actor, InquiryActivator, InquiryMailer, InquiryRepo, NewSubmission, SubmissionRow } from "@/lib/security/inquiry-types";
import type { RateLimitStore } from "@/lib/security/rate-limit";
import type { ServiceDeps } from "@/lib/security/inquiry-service";
import type { TurnstileResult } from "@/lib/security/turnstile";

/** In-memory stand-in for the Postgres-backed repo, with the same atomic semantics. */
export class MemoryRepo implements InquiryRepo {
  rows: SubmissionRow[] = [];
  holds = new Map<string, { submissionId: string; expires: string }>();
  blocks: { kind: string; hash: string; expires: string }[] = [];
  events: { action: string; details: Record<string, unknown>; submissionId?: string | null; actor?: Actor }[] = [];
  constructor(private now: () => Date) {}

  async findByIdempotencyKey(key: string) {
    return this.rows.find((r) => r.idempotency_key === key) ?? null;
  }
  async findOpenDuplicate(q: { emailNormalized: string; kind: string; eventDate?: string; eventType?: string; slotStart?: string; sinceIso: string }) {
    return (
      [...this.rows]
        .reverse()
        .find(
          (r) =>
            r.email_normalized === q.emailNormalized &&
            r.kind === q.kind &&
            ["pending_verification", "verified", "needs_review"].includes(r.status) &&
            r.created_at >= q.sinceIso &&
            (!q.eventDate || r.event_date === q.eventDate) &&
            (!q.eventType || r.event_type === q.eventType) &&
            (!q.slotStart || r.slot_start === q.slotStart)
        ) ?? null
    );
  }
  async countByEmail(e: string, since: string) {
    return this.rows.filter((r) => r.email_normalized === e && r.created_at >= since).length;
  }
  async countOtherEmailsWithMessage(h: string, ex: string, since: string) {
    return new Set(this.rows.filter((r) => r.message_hash === h && r.email_normalized !== ex && r.created_at >= since).map((r) => r.email_normalized)).size;
  }
  async countOtherEmailsFromSource(h: string, ex: string, since: string) {
    return new Set(this.rows.filter((r) => r.source_hash === h && r.email_normalized !== ex && r.created_at >= since).map((r) => r.email_normalized)).size;
  }
  async isBlocked(kind: string, hash: string, nowIso: string) {
    return this.blocks.some((b) => b.kind === kind && b.hash === hash && b.expires > nowIso);
  }
  async insert(row: NewSubmission) {
    if (row.idempotency_key && this.rows.some((r) => r.idempotency_key === row.idempotency_key)) throw Object.assign(new Error("dup"), { code: "23505" });
    const now = this.now().toISOString();
    const full: SubmissionRow = {
      ...row,
      id: randomUUID(),
      created_at: now,
      updated_at: now,
      verified_at: null,
      activation_claimed_at: null,
      activated_at: null,
      event_id: null,
      reviewed_by: null,
      reviewed_by_label: null,
      reviewed_at: null,
      review_note: null
    };
    this.rows.push(full);
    return { ...full };
  }
  async update(id: string, patch: Partial<SubmissionRow>) {
    const r = this.rows.find((x) => x.id === id);
    if (r) Object.assign(r, patch);
  }
  async get(id: string) {
    const r = this.rows.find((x) => x.id === id);
    return r ? { ...r } : null;
  }
  async findByTokenHash(h: string) {
    const r = this.rows.find((x) => x.verification_token_hash === h);
    return r ? { ...r } : null;
  }
  async consumeToken(h: string, nowIso: string) {
    const r = this.rows.find(
      (x) => x.verification_token_hash === h && !x.verified_at && (x.verification_expires_at ?? "") > nowIso && ["pending_verification", "needs_review"].includes(x.status)
    );
    if (!r) return null;
    r.verified_at = nowIso;
    return { ...r };
  }
  async claimActivation(id: string, nowIso: string) {
    const r = this.rows.find((x) => x.id === id);
    if (!r || r.activation_claimed_at || r.event_id) return false;
    r.activation_claimed_at = nowIso;
    return true;
  }
  async releaseActivationClaim(id: string) {
    const r = this.rows.find((x) => x.id === id);
    if (r && !r.event_id) r.activation_claimed_at = null;
  }
  async latestUnverifiedForEmail(e: string, since: string) {
    return [...this.rows].reverse().find((r) => r.email_normalized === e && !r.verified_at && ["pending_verification", "needs_review"].includes(r.status) && r.created_at >= since) ?? null;
  }
  async claimHold(slotStart: string, _end: string, submissionId: string, expiresIso: string) {
    const h = this.holds.get(slotStart);
    if (h && h.expires > this.now().toISOString()) return false;
    this.holds.set(slotStart, { submissionId, expires: expiresIso });
    return true;
  }
  async releaseHold(submissionId: string) {
    for (const [k, v] of this.holds) if (v.submissionId === submissionId) this.holds.delete(k);
  }
  async logEvent(action: string, details: Record<string, unknown>, submissionId?: string | null, actor?: Actor) {
    this.events.push({ action, details, submissionId, actor });
  }
}

/** Fixed-window counter with the same semantics as security_rate_limit_hit. */
export class MemoryRateLimits implements RateLimitStore {
  counts = new Map<string, number>();
  constructor(private now: () => Date) {}
  async hit(bucket: string, limit: number, windowSeconds: number) {
    const w = Math.floor(this.now().getTime() / 1000 / windowSeconds);
    const key = `${bucket}|${w}`;
    const hits = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, hits);
    return { allowed: hits <= limit, hits, retryAfterSeconds: (w + 1) * windowSeconds - Math.floor(this.now().getTime() / 1000) };
  }
}

export function makeDeps(opts: { now?: Date; captcha?: TurnstileResult; mailResult?: "sent" | "not_configured" | "failed" } = {}) {
  const clock = { t: opts.now ?? new Date("2026-11-11T18:00:00Z") };
  const now = () => clock.t;
  const repo = new MemoryRepo(now);
  const rateLimits = new MemoryRateLimits(now);
  const mail: { to: string; link: string; kind: string }[] = [];
  const mailer: InquiryMailer = {
    async sendVerification(to, link, _h, kind) {
      mail.push({ to, link, kind });
      return opts.mailResult ?? "sent";
    }
  };
  const activated: string[] = [];
  const activator: InquiryActivator = {
    async activate(sub) {
      activated.push(sub.id);
      return `event-${sub.id}`;
    }
  };
  const captchaCalls: { token?: string; action: string }[] = [];
  const deps: ServiceDeps = {
    repo,
    rateLimits,
    mailer,
    activator,
    verifyCaptcha: async (token, _ip, action) => {
      captchaCalls.push({ token, action });
      if (opts.captcha) return opts.captcha;
      return token === "good-token" ? { ok: true } : { ok: false, reason: token ? "invalid" : "missing" };
    },
    now,
    appOrigin: "https://www.cratesdjs.com",
    verificationTtlHours: 24
  };
  return { deps, repo, rateLimits, mail, activated, clock, captchaCalls };
}

export function validInquiry(over: Record<string, unknown> = {}) {
  return {
    name: "Jordan Lee",
    email: "jordan.lee@gmail.com",
    phone: "(312) 555-0100",
    eventDate: "2026-12-12",
    eventType: "Wedding",
    venueName: "The Drake",
    expectedGuests: 150,
    budgetRange: "$2,000–$3,500",
    message: "Looking for a DJ for our reception, mostly R&B and Motown.",
    turnstileToken: "good-token",
    elapsedMs: 45000,
    submissionId: `sub_${Math.random().toString(36).slice(2, 12)}`,
    ...over
  };
}

export function tokenFromLink(link: string) {
  return link.split("#t=")[1];
}
