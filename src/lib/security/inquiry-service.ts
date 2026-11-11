import { describeIssues, inquirySchema, consultationSchema } from "@/lib/security/inquiry-validation";
import { assessRisk } from "@/lib/security/risk";
import { keyedHash, messageFingerprint, normalizeEmail, randomToken, sha256Hex, maskEmail } from "@/lib/security/crypto";
import { ipBucket } from "@/lib/security/client-ip";
import { enforce, limits, retryMessage, type RateLimitStore } from "@/lib/security/rate-limit";
import { verifyTurnstile, turnstileMessage, TURNSTILE_ACTIONS, type TurnstileResult } from "@/lib/security/turnstile";
import { isPastEventDate } from "@/lib/security/business-date";
import type { InquiryActivator, InquiryKind, InquiryMailer, InquiryRepo, InquirySource, SubmissionRow } from "@/lib/security/inquiry-types";

export interface ServiceDeps {
  repo: InquiryRepo;
  rateLimits: RateLimitStore;
  mailer: InquiryMailer;
  activator: InquiryActivator;
  verifyCaptcha: (token: string | undefined, ip: string, action: string) => Promise<TurnstileResult>;
  now: () => Date;
  appOrigin: string;
  verificationTtlHours: number;
  /** Consultation only: is this slot still open? (hours, past times, overlaps) */
  slotAvailable?: (date: string, time: string) => Promise<{ ok: true; start: Date; end: Date } | { ok: false; status: number; error: string }>;
}

export interface RequestContext {
  ip: string;
  /** Server-to-server submission from the WordPress site, authenticated with INQUIRY_PARTNER_SECRET. */
  partner: boolean;
}

export interface ServiceResponse {
  status: number;
  body: Record<string, unknown>;
}

export function defaultVerificationTtlHours(): number {
  const v = Number(process.env.INQUIRY_VERIFICATION_TTL_HOURS);
  return Number.isFinite(v) && v >= 1 && v <= 168 ? v : 24;
}

/** Same reply for every accepted request — real, duplicate, or silently dropped spam. */
function received(hours: number): ServiceResponse {
  return {
    status: 200,
    body: {
      ok: true,
      next: "check_email",
      message: `Thanks! We sent a confirmation link to your email. Please click it within ${hours} hours so we can review your request.`
    }
  };
}

function hoursFromNow(now: Date, hours: number) {
  return new Date(now.getTime() + hours * 3600 * 1000).toISOString();
}

export function verificationLink(origin: string, token: string): string {
  // The token goes in the URL fragment: browsers never send it to any server
  // (so it can't land in access logs or Referer headers), and the page only
  // spends it when the person clicks the button, so link scanners can't.
  return `${origin.replace(/\/$/, "")}/inquiry/verify#t=${token}`;
}

/** Issues a fresh token (invalidating the old one) and emails it, within the email/IP limits. */
export async function issueVerification(
  sub: SubmissionRow,
  ctx: { sourceHash: string },
  deps: ServiceDeps
): Promise<"sent" | "limited" | "not_configured" | "failed"> {
  const L = limits();
  const emailKey = keyedHash("email", sub.email_normalized);
  const gate = await enforce(deps.rateLimits, [
    { bucket: `verify-email:e:${emailKey}`, limit: L.verifyEmailPerEmail.limit, window: L.verifyEmailPerEmail.window },
    { bucket: `verify-email:s:${ctx.sourceHash}`, limit: L.verifyEmailPerSource.limit, window: L.verifyEmailPerSource.window }
  ]);
  if (!gate.allowed) {
    await deps.repo.logEvent("verification_email_limited", { email: maskEmail(sub.email) }, sub.id);
    return "limited";
  }
  const token = randomToken();
  const now = deps.now();
  await deps.repo.update(sub.id, {
    verification_token_hash: sha256Hex(token),
    verification_expires_at: hoursFromNow(now, deps.verificationTtlHours),
    verification_sent_count: (sub.verification_sent_count ?? 0) + 1,
    last_verification_sent_at: now.toISOString()
  });
  const result = await deps.mailer.sendVerification(sub.email, verificationLink(deps.appOrigin, token), deps.verificationTtlHours, sub.kind);
  await deps.repo.logEvent(result === "sent" ? "verification_email_sent" : `verification_email_${result}`, { email: maskEmail(sub.email) }, sub.id);
  return result;
}

/**
 * Public inquiry or consultation request. Order: rate limit → field
 * validation (incl. past dates) → security check → idempotency/duplicates
 * → risk signals → save as pending → verification email. Nothing is
 * reserved, notified or automated here; that waits for activation.
 */
export async function submitPublicRequest(kind: InquiryKind, raw: unknown, ctx: RequestContext, deps: ServiceDeps): Promise<ServiceResponse> {
  const now = deps.now();
  const sourceHash = keyedHash("ip", ipBucket(ctx.ip));
  const L = limits();
  const source: InquirySource = kind === "consultation" ? "scheduler" : ctx.partner ? "wordpress" : "website";

  const rl = await enforce(deps.rateLimits, [
    kind === "consultation"
      ? { bucket: `consult:s:${sourceHash}`, limit: L.consultationPerSource.limit, window: L.consultationPerSource.window }
      : { bucket: `inquiry:s:${sourceHash}`, limit: L.inquiryPerSource.limit, window: L.inquiryPerSource.window }
  ]);
  if (!rl.allowed) {
    await deps.repo.logEvent("rate_limited", { scope: kind, source });
    return { status: 429, body: { error: retryMessage(rl.retryAfterSeconds), retryAfterSeconds: rl.retryAfterSeconds } };
  }

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { status: 400, body: { error: "Please check the form and try again." } };
  }

  const schema = kind === "consultation" ? consultationSchema(now) : inquirySchema(now);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const d = describeIssues(parsed.error.issues);
    if (d.unexpectedFields.length) await deps.repo.logEvent("rejected_unexpected_fields", { fields: d.unexpectedFields.slice(0, 10), scope: kind });
    return { status: 400, body: { error: d.message, fieldErrors: d.fieldErrors } };
  }
  const data = parsed.data as Record<string, unknown> & { name: string; email: string; turnstileToken?: string; website?: string; elapsedMs?: number; submissionId?: string; message?: string };

  if (!ctx.partner) {
    const action = kind === "consultation" ? TURNSTILE_ACTIONS.consultation : TURNSTILE_ACTIONS.inquiry;
    const captcha = await deps.verifyCaptcha(data.turnstileToken, ctx.ip, action);
    if (!captcha.ok) {
      await deps.repo.logEvent("turnstile_failed", { reason: captcha.reason, scope: kind });
      const unavailable = captcha.reason === "unavailable" || captcha.reason === "not_configured";
      return { status: unavailable ? 503 : 400, body: { error: turnstileMessage(captcha.reason), retryCaptcha: true } };
    }
  }

  const emailNormalized = normalizeEmail(data.email);
  const idempotencyKey = data.submissionId ? `${kind}:${data.submissionId}` : null;
  if (idempotencyKey) {
    const existing = await deps.repo.findByIdempotencyKey(idempotencyKey);
    if (existing && existing.email_normalized === emailNormalized) return received(deps.verificationTtlHours);
  }

  // Consultation: work out and check the requested slot.
  let slotStart: Date | null = null;
  let slotEnd: Date | null = null;
  if (kind === "consultation") {
    if (!deps.slotAvailable) throw new Error("slotAvailable dependency missing");
    const slot = await deps.slotAvailable(String(data.date), String(data.time));
    if (!slot.ok) return { status: slot.status, body: { error: slot.error } };
    slotStart = slot.start;
    slotEnd = slot.end;
  }

  const since24h = new Date(now.getTime() - 24 * 3600 * 1000).toISOString();
  const dup = await deps.repo.findOpenDuplicate({
    emailNormalized,
    kind,
    eventDate: kind === "inquiry" ? String(data.eventDate) : undefined,
    eventType: kind === "inquiry" ? String(data.eventType) : undefined,
    slotStart: slotStart?.toISOString(),
    sinceIso: new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString()
  });
  if (dup) {
    await deps.repo.logEvent("duplicate_ignored", { email: maskEmail(data.email), scope: kind }, dup.id);
    // A person re-sending because they never got the email: send a fresh link (within limits).
    if (!dup.verified_at && dup.status !== "spam") await issueVerification(dup, { sourceHash }, deps);
    return received(deps.verificationTtlHours);
  }

  const messageHash = messageFingerprint(data.message);
  const emailHash = keyedHash("email", emailNormalized);
  const [recentSameEmail, sameMessageOtherEmails, otherEmailsFromSource, emailBlocked, sourceBlocked] = await Promise.all([
    deps.repo.countByEmail(emailNormalized, since24h),
    messageHash ? deps.repo.countOtherEmailsWithMessage(messageHash, emailNormalized, since24h) : Promise.resolve(0),
    deps.repo.countOtherEmailsFromSource(sourceHash, emailNormalized, since24h),
    deps.repo.isBlocked("email", emailHash, now.toISOString()),
    deps.repo.isBlocked("source", sourceHash, now.toISOString())
  ]);
  const risk = assessRisk({
    honeypotFilled: !!data.website,
    elapsedMs: data.elapsedMs,
    email: data.email,
    name: data.name,
    message: data.message,
    venueName: data.venueName as string | undefined,
    recentSameEmail,
    sameMessageOtherEmails,
    otherEmailsFromSource,
    emailBlocked,
    sourceBlocked
  });

  let row: SubmissionRow;
  try {
    row = await deps.repo.insert({
      kind,
      source,
      status: risk.spam ? "spam" : risk.needsReview ? "needs_review" : "pending_verification",
      idempotency_key: idempotencyKey,
      name: data.name,
      email: data.email.trim(),
      email_normalized: emailNormalized,
      phone: (data.phone as string | undefined) ?? null,
      event_date: kind === "inquiry" ? String(data.eventDate) : slotStart ? String(data.date) : null,
      event_type: kind === "inquiry" ? String(data.eventType) : "consultation",
      preferred_dj_id: (data.preferredDjId as string | undefined) ?? null,
      venue_name: (data.venueName as string | undefined) ?? null,
      expected_guests: (data.expectedGuests as number | undefined) ?? null,
      budget_range: (data.budgetRange as string | undefined) ?? null,
      message: data.message ?? null,
      slot_start: slotStart?.toISOString() ?? null,
      slot_end: slotEnd?.toISOString() ?? null,
      message_hash: messageHash,
      source_hash: sourceHash,
      completion_ms: data.elapsedMs ?? null,
      risk_score: risk.score,
      risk_reasons: risk.reasons,
      verification_token_hash: null,
      verification_expires_at: null,
      verification_sent_count: 0,
      last_verification_sent_at: null
    });
  } catch (err) {
    // Same submissionId raced in twice: the first one wins, the second is a no-op.
    if (typeof err === "object" && err !== null && (err as { code?: string }).code === "23505") return received(deps.verificationTtlHours);
    throw err;
  }

  await deps.repo.logEvent(risk.spam ? "submission_spam" : risk.needsReview ? "submission_flagged" : "submission_received", {
    scope: kind,
    source,
    email: maskEmail(data.email),
    risk: risk.score,
    reasons: risk.reasons
  }, row.id);

  if (risk.spam) return received(deps.verificationTtlHours);

  if (kind === "consultation" && slotStart && slotEnd) {
    const held = await deps.repo.claimHold(slotStart.toISOString(), slotEnd.toISOString(), row.id, hoursFromNow(now, deps.verificationTtlHours));
    if (!held) {
      await deps.repo.update(row.id, { status: "archived", review_note: "Slot was taken before this request could hold it" });
      return { status: 409, body: { error: "That time was just booked — please pick another slot." } };
    }
  }

  const sent = await issueVerification(row, { sourceHash }, deps);
  if (sent === "limited") {
    return {
      status: 200,
      body: { ok: true, next: "check_email", message: "We've already sent several confirmation emails to this address recently. Please check your inbox and spam folder, or try again in an hour." }
    };
  }
  return received(deps.verificationTtlHours);
}

export type VerifyOutcome = "verified" | "received" | "already" | "expired" | "invalid" | "date_passed" | "limited";

export async function verifySubmissionToken(token: unknown, ctx: { ip: string }, deps: ServiceDeps): Promise<{ status: number; outcome: VerifyOutcome; kind?: InquiryKind; retryAfterSeconds?: number }> {
  const L = limits();
  const sourceHash = keyedHash("ip", ipBucket(ctx.ip));
  const rl = await enforce(deps.rateLimits, [{ bucket: `verify:s:${sourceHash}`, limit: L.verifyAttemptPerSource.limit, window: L.verifyAttemptPerSource.window }]);
  if (!rl.allowed) return { status: 429, outcome: "limited", retryAfterSeconds: rl.retryAfterSeconds };

  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) return { status: 400, outcome: "invalid" };
  const tokenHash = sha256Hex(token);
  const now = deps.now();

  const sub = await deps.repo.consumeToken(tokenHash, now.toISOString());
  if (!sub) {
    const known = await deps.repo.findByTokenHash(tokenHash);
    if (!known) return { status: 400, outcome: "invalid" };
    if (known.verified_at) return { status: 200, outcome: "already", kind: known.kind };
    if (known.verification_expires_at && known.verification_expires_at <= now.toISOString()) return { status: 410, outcome: "expired", kind: known.kind };
    return { status: 400, outcome: "invalid" };
  }
  await deps.repo.logEvent("email_verified", { email: maskEmail(sub.email) }, sub.id);

  // The event date (or call time) may have passed while the email sat unopened.
  const passed =
    sub.kind === "inquiry" ? !!sub.event_date && isPastEventDate(sub.event_date, now) : !!sub.slot_start && sub.slot_start <= now.toISOString();
  if (passed) {
    await deps.repo.update(sub.id, { status: "archived", review_note: "Date passed before the email was confirmed" });
    await deps.repo.releaseHold(sub.id);
    return { status: 200, outcome: "date_passed", kind: sub.kind };
  }

  if (sub.status === "needs_review") {
    // Stays in the review queue; activation waits for an admin.
    return { status: 200, outcome: "received", kind: sub.kind };
  }

  await deps.repo.update(sub.id, { status: "verified" });
  await activateSubmission({ ...sub, status: "verified" }, deps, { userId: null, label: "Email verification" });
  return { status: 200, outcome: "verified", kind: sub.kind };
}

/** Turns a verified/approved submission into a real lead exactly once. */
export async function activateSubmission(sub: SubmissionRow, deps: Pick<ServiceDeps, "repo" | "activator" | "now">, actor: { userId: string | null; label: string }): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  if (sub.event_id) return { ok: true, eventId: sub.event_id };
  const claimed = await deps.repo.claimActivation(sub.id, deps.now().toISOString());
  if (!claimed) return { ok: true };
  try {
    const eventId = await deps.activator.activate(sub);
    await deps.repo.update(sub.id, { event_id: eventId, activated_at: deps.now().toISOString() });
    await deps.repo.releaseHold(sub.id);
    await deps.repo.logEvent("lead_activated", { eventId }, sub.id, actor);
    return { ok: true, eventId };
  } catch (err) {
    await deps.repo.releaseActivationClaim(sub.id);
    await deps.repo.logEvent("lead_activation_failed", { error: err instanceof Error ? err.message.slice(0, 200) : "unknown" }, sub.id, actor);
    return { ok: false, error: err instanceof Error ? err.message : "Activation failed" };
  }
}

/** "Send me a new link." Same neutral answer whether or not anything was found. */
export async function resendVerification(raw: unknown, ctx: RequestContext, deps: ServiceDeps): Promise<ServiceResponse> {
  const neutral: ServiceResponse = {
    status: 200,
    body: { ok: true, message: "If there's a request waiting for that address, we've sent a new confirmation link. Please check your inbox and spam folder." }
  };
  const L = limits();
  const sourceHash = keyedHash("ip", ipBucket(ctx.ip));
  const rl = await enforce(deps.rateLimits, [{ bucket: `resend:s:${sourceHash}`, limit: L.verifyEmailPerSource.limit, window: L.verifyEmailPerSource.window }]);
  if (!rl.allowed) return { status: 429, body: { error: retryMessage(rl.retryAfterSeconds) } };

  const body = (raw ?? {}) as { email?: unknown; turnstileToken?: unknown };
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: 400, body: { error: "Please enter a valid email address." } };

  const captcha = await deps.verifyCaptcha(typeof body.turnstileToken === "string" ? body.turnstileToken : undefined, ctx.ip, TURNSTILE_ACTIONS.resend);
  if (!captcha.ok) {
    await deps.repo.logEvent("turnstile_failed", { reason: captcha.reason, scope: "resend" });
    const unavailable = captcha.reason === "unavailable" || captcha.reason === "not_configured";
    return { status: unavailable ? 503 : 400, body: { error: turnstileMessage(captcha.reason), retryCaptcha: true } };
  }

  const now = deps.now();
  const sub = await deps.repo.latestUnverifiedForEmail(normalizeEmail(email), new Date(now.getTime() - 14 * 24 * 3600 * 1000).toISOString());
  if (!sub || sub.status === "spam" || sub.status === "archived") return neutral;
  if (sub.kind === "inquiry" && sub.event_date && isPastEventDate(sub.event_date, now)) return neutral;
  const r = await issueVerification(sub, { sourceHash }, deps);
  if (r === "limited") {
    return { status: 429, body: { error: "We've already sent several links to this address recently. Please check your inbox and spam folder, or try again in an hour." } };
  }
  return neutral;
}

/** Real dependencies for API routes. */
export async function productionDeps(extra?: Partial<ServiceDeps>): Promise<ServiceDeps> {
  const { supabaseInquiryRepo } = await import("@/lib/security/inquiry-repo");
  const { supabaseRateLimitStore } = await import("@/lib/security/rate-limit");
  const { systemInquiryMailer, leadActivator } = await import("@/lib/security/inquiry-activation");
  return {
    repo: supabaseInquiryRepo,
    rateLimits: supabaseRateLimitStore,
    mailer: systemInquiryMailer,
    activator: leadActivator,
    verifyCaptcha: (token, ip, action) => verifyTurnstile({ token, ip, expectedAction: action }),
    now: () => new Date(),
    appOrigin: (process.env.NEXT_PUBLIC_APP_URL || "https://www.cratesdjs.com").replace(/\/$/, ""),
    verificationTtlHours: defaultVerificationTtlHours(),
    ...extra
  };
}
