import { activateSubmission, issueVerification, type ServiceDeps } from "@/lib/security/inquiry-service";
import { keyedHash, maskEmail } from "@/lib/security/crypto";
import type { Actor, SubmissionRow } from "@/lib/security/inquiry-types";

export interface BlockStore {
  addBlock(b: { kind: "email" | "source"; valueHash: string; label: string; reason: string; expiresIso: string; actor: Actor }): Promise<string>;
  removeBlock(id: string, actor: Actor, nowIso: string): Promise<boolean>;
}

export type AdminAction =
  | { action: "approve"; id: string; note?: string }
  | { action: "spam"; id: string; note?: string }
  | { action: "restore"; id: string; note?: string }
  | { action: "resend"; id: string }
  | { action: "block"; id: string; kind: "email" | "source"; hours: number; reason?: string }
  | { action: "unblock"; blockId: string };

export interface AdminResult {
  status: number;
  body: { ok?: boolean; error?: string; message?: string; eventId?: string };
}

function stamp(actor: Actor, nowIso: string, note?: string): Partial<SubmissionRow> {
  return { reviewed_by: actor.userId, reviewed_by_label: actor.label, reviewed_at: nowIso, ...(note ? { review_note: note.slice(0, 500) } : {}) };
}

/** Every manual override is explicit, recorded with who did it, and logged. */
export async function runAdminAction(a: AdminAction, actor: Actor, deps: ServiceDeps & { blocks: BlockStore }): Promise<AdminResult> {
  const nowIso = deps.now().toISOString();

  if (a.action === "unblock") {
    const removed = await deps.blocks.removeBlock(a.blockId, actor, nowIso);
    if (!removed) return { status: 404, body: { error: "That block was not found or is already removed." } };
    await deps.repo.logEvent("block_removed", { blockId: a.blockId }, null, actor);
    return { status: 200, body: { ok: true, message: "Block removed." } };
  }

  const sub = await deps.repo.get(a.id);
  if (!sub) return { status: 404, body: { error: "Inquiry not found." } };

  switch (a.action) {
    case "approve": {
      if (sub.event_id) return { status: 200, body: { ok: true, message: "Already a lead.", eventId: sub.event_id } };
      if (sub.kind === "consultation" && sub.slot_start && sub.slot_start <= nowIso) {
        return { status: 409, body: { error: "This call time has already passed. Contact the client to book a new time." } };
      }
      const override = !sub.verified_at;
      await deps.repo.update(sub.id, { status: "verified", ...stamp(actor, nowIso, a.note) });
      await deps.repo.logEvent(override ? "approved_without_email_verification" : "approved", { email: maskEmail(sub.email), from: sub.status }, sub.id, actor);
      const r = await activateSubmission({ ...sub, status: "verified" }, deps, actor);
      if (!r.ok) return { status: 503, body: { error: `Approved, but creating the lead failed: ${r.error}. Try Approve again.` } };
      return { status: 200, body: { ok: true, message: override ? "Approved without email confirmation (recorded)." : "Approved — now a lead.", eventId: r.eventId } };
    }
    case "spam": {
      if (sub.event_id) return { status: 409, body: { error: "This is already a lead. Decline it from Lead Capture instead." } };
      await deps.repo.update(sub.id, { status: "spam", ...stamp(actor, nowIso, a.note) });
      await deps.repo.releaseHold(sub.id);
      await deps.repo.logEvent("marked_spam", { email: maskEmail(sub.email), from: sub.status }, sub.id, actor);
      return { status: 200, body: { ok: true, message: "Marked as spam." } };
    }
    case "restore": {
      if (sub.status !== "spam" && sub.status !== "archived") return { status: 409, body: { error: "Only spam or archived inquiries can be restored." } };
      const next = sub.verified_at ? "needs_review" : "pending_verification";
      await deps.repo.update(sub.id, { status: next, ...stamp(actor, nowIso, a.note) });
      await deps.repo.logEvent("restored", { from: sub.status, to: next }, sub.id, actor);
      return {
        status: 200,
        body: { ok: true, message: next === "needs_review" ? "Restored to the review queue — approve it to make it a lead." : "Restored. Send a new confirmation email or approve it." }
      };
    }
    case "resend": {
      if (sub.verified_at) return { status: 409, body: { error: "This email is already confirmed." } };
      if (sub.status === "spam") return { status: 409, body: { error: "Restore it before sending a confirmation email." } };
      const r = await issueVerification(sub, { sourceHash: sub.source_hash ?? "admin" }, deps);
      await deps.repo.logEvent("admin_resend", { result: r }, sub.id, actor);
      if (r === "limited") return { status: 429, body: { error: "This address has had 3 confirmation emails in the last hour. Try again later." } };
      if (r === "not_configured") return { status: 503, body: { error: "Email isn't configured (RESEND_API_KEY / SYSTEM_EMAIL_FROM)." } };
      if (r === "failed") return { status: 503, body: { error: "The email provider rejected the message. Try again shortly." } };
      return { status: 200, body: { ok: true, message: "New confirmation email sent." } };
    }
    case "block": {
      const hours = Math.round(Number(a.hours));
      if (!Number.isFinite(hours) || hours < 1 || hours > 720) return { status: 400, body: { error: "Blocks last between 1 hour and 30 days." } };
      const valueHash = a.kind === "email" ? keyedHash("email", sub.email_normalized) : sub.source_hash;
      if (!valueHash) return { status: 400, body: { error: "No network information is stored for this inquiry." } };
      const label = a.kind === "email" ? maskEmail(sub.email) : `Network of inquiry from ${maskEmail(sub.email)}`;
      const expiresIso = new Date(deps.now().getTime() + hours * 3600 * 1000).toISOString();
      const blockId = await deps.blocks.addBlock({ kind: a.kind, valueHash, label, reason: (a.reason ?? "").slice(0, 300), expiresIso, actor });
      await deps.repo.logEvent("block_added", { kind: a.kind, label, hours, blockId }, sub.id, actor);
      return { status: 200, body: { ok: true, message: `Blocked for ${hours} hour${hours === 1 ? "" : "s"}.` } };
    }
  }
  return { status: 400, body: { error: "Unknown action." } };
}
