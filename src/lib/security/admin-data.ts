import { createAdminClient } from "@/lib/supabase/admin";
import { turnstileConfigured } from "@/lib/security/turnstile";
import { hashSecretConfigured } from "@/lib/security/crypto";
import { accountRole, isStaffRole } from "@/lib/roles";
import type { BlockStore } from "@/lib/security/admin-actions";

export const supabaseBlockStore: BlockStore = {
  async addBlock(b) {
    const { data, error } = await createAdminClient()
      .from("security_blocks")
      .insert({ kind: b.kind, value_hash: b.valueHash, label: b.label, reason: b.reason || null, expires_at: b.expiresIso, created_by: b.actor.userId, created_by_label: b.actor.label })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  },
  async removeBlock(id, actor, nowIso) {
    const { data, error } = await createAdminClient()
      .from("security_blocks")
      .update({ removed_at: nowIso, removed_by: actor.userId, removed_by_label: actor.label })
      .eq("id", id)
      .is("removed_at", null)
      .select("id");
    if (error) throw error;
    return (data ?? []).length === 1;
  }
};

const LIST_COLUMNS =
  "id, created_at, updated_at, kind, source, status, name, email, phone, event_date, event_type, venue_name, expected_guests, budget_range, message, slot_start, risk_score, risk_reasons, verification_sent_count, last_verification_sent_at, verification_expires_at, verified_at, activated_at, event_id, reviewed_by_label, reviewed_at, review_note, completion_ms";

const COUNTED_EVENTS = [
  "rate_limited",
  "turnstile_failed",
  "submission_spam",
  "submission_flagged",
  "duplicate_ignored",
  "rejected_unexpected_fields",
  "verification_email_limited",
  "verification_email_not_configured",
  "verification_email_failed"
];

export async function securityOverview() {
  const db = createAdminClient();
  const since24 = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const since7 = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  const list = (status: string, limit = 50) =>
    db.from("inquiry_submissions").select(LIST_COLUMNS).eq("status", status).order("created_at", { ascending: false }).limit(limit);

  const [pending, review, verified, spam, archived, statusRows, events7, history, blocks] = await Promise.all([
    list("pending_verification"),
    list("needs_review"),
    list("verified", 30),
    list("spam", 30),
    list("archived", 20),
    db.from("inquiry_submissions").select("status").gte("created_at", since7).limit(5000),
    db.from("security_events").select("action, created_at").in("action", COUNTED_EVENTS).gte("created_at", since7).limit(10000),
    db.from("security_events").select("id, created_at, action, actor_label, submission_id, details").order("created_at", { ascending: false }).limit(150),
    db.from("security_blocks").select("id, kind, label, reason, expires_at, created_at, created_by_label, removed_at, removed_by_label").order("created_at", { ascending: false }).limit(50)
  ]);
  const firstError = [pending, review, verified, spam, archived, statusRows, events7, history, blocks].find((r) => r.error)?.error;
  if (firstError) throw firstError;

  const statusCounts7: Record<string, number> = {};
  for (const r of statusRows.data ?? []) statusCounts7[r.status] = (statusCounts7[r.status] ?? 0) + 1;

  const signals: Record<string, { day: number; week: number }> = {};
  for (const a of COUNTED_EVENTS) signals[a] = { day: 0, week: 0 };
  for (const e of events7.data ?? []) {
    signals[e.action].week += 1;
    if (e.created_at >= since24) signals[e.action].day += 1;
  }

  const nowIso = new Date().toISOString();
  return {
    lists: {
      pending_verification: pending.data ?? [],
      needs_review: review.data ?? [],
      verified: verified.data ?? [],
      spam: spam.data ?? [],
      archived: archived.data ?? []
    },
    statusCounts7,
    signals,
    history: history.data ?? [],
    blocks: (blocks.data ?? []).map((b) => ({ ...b, active: !b.removed_at && b.expires_at > nowIso })),
    setup: {
      turnstile: turnstileConfigured(),
      partnerSecret: (process.env.INQUIRY_PARTNER_SECRET ?? "").length >= 32,
      hashSecret: hashSecretConfigured(),
      email: !!process.env.RESEND_API_KEY && !!process.env.SYSTEM_EMAIL_FROM,
      appUrl: !!process.env.NEXT_PUBLIC_APP_URL,
      mfaRequired: process.env.ADMIN_MFA_REQUIRED === "true",
      cronSecret: (process.env.CRON_SECRET ?? "").length >= 16
    }
  };
}

/** Staff accounts and their 2FA status, for the owner to review. */
export async function staffAccounts() {
  const db = createAdminClient();
  const out: { id: string; email: string | null; role: string; lastSignIn: string | null; factors: number; userMetadataRole: string | null }[] = [];
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    for (const u of data.users) {
      const role = accountRole(u);
      const metaRole = (u.user_metadata?.role as string | undefined) ?? null;
      if (!isStaffRole(role) && !isStaffRole(metaRole)) continue;
      out.push({
        id: u.id,
        email: u.email ?? null,
        role: role ?? "none",
        lastSignIn: u.last_sign_in_at ?? null,
        factors: (u.factors ?? []).filter((f) => f.status === "verified").length,
        // Shown so an owner can spot accounts whose self-editable profile claims a staff role.
        userMetadataRole: metaRole && metaRole !== role ? metaRole : null
      });
    }
    if (data.users.length < 200) break;
  }
  return out;
}
