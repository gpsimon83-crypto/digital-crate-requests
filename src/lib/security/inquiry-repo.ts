import { createAdminClient } from "@/lib/supabase/admin";
import type { InquiryRepo, SubmissionRow } from "@/lib/security/inquiry-types";

const OPEN = ["pending_verification", "verified", "needs_review"];

function rowOf(r: Record<string, unknown> | null): SubmissionRow | null {
  if (!r) return null;
  return { ...(r as unknown as SubmissionRow), risk_reasons: Array.isArray(r.risk_reasons) ? (r.risk_reasons as string[]) : [] };
}

async function distinctEmails(column: "message_hash" | "source_hash", value: string, excludeEmail: string, sinceIso: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("inquiry_submissions")
    .select("email_normalized")
    .eq(column, value)
    .neq("email_normalized", excludeEmail)
    .gte("created_at", sinceIso)
    .limit(200);
  if (error) throw error;
  return new Set((data ?? []).map((r) => r.email_normalized)).size;
}

/** Postgres-backed storage for the inquiry flow (service role; parameterised via supabase-js). */
export const supabaseInquiryRepo: InquiryRepo = {
  async findByIdempotencyKey(key) {
    const { data, error } = await createAdminClient().from("inquiry_submissions").select("*").eq("idempotency_key", key).maybeSingle();
    if (error) throw error;
    return rowOf(data);
  },

  async findOpenDuplicate(q) {
    let query = createAdminClient()
      .from("inquiry_submissions")
      .select("*")
      .eq("email_normalized", q.emailNormalized)
      .eq("kind", q.kind)
      .in("status", OPEN)
      .gte("created_at", q.sinceIso);
    if (q.eventDate) query = query.eq("event_date", q.eventDate);
    if (q.eventType) query = query.eq("event_type", q.eventType);
    if (q.slotStart) query = query.eq("slot_start", q.slotStart);
    const { data, error } = await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) throw error;
    return rowOf(data);
  },

  async countByEmail(emailNormalized, sinceIso) {
    const { count, error } = await createAdminClient()
      .from("inquiry_submissions")
      .select("id", { count: "exact", head: true })
      .eq("email_normalized", emailNormalized)
      .gte("created_at", sinceIso);
    if (error) throw error;
    return count ?? 0;
  },

  countOtherEmailsWithMessage: (hash, exclude, since) => distinctEmails("message_hash", hash, exclude, since),
  countOtherEmailsFromSource: (hash, exclude, since) => distinctEmails("source_hash", hash, exclude, since),

  async isBlocked(kind, valueHash, nowIso) {
    const { data, error } = await createAdminClient()
      .from("security_blocks")
      .select("id")
      .eq("kind", kind)
      .eq("value_hash", valueHash)
      .is("removed_at", null)
      .gt("expires_at", nowIso)
      .limit(1);
    if (error) throw error;
    return (data ?? []).length > 0;
  },

  async insert(row) {
    const { data, error } = await createAdminClient().from("inquiry_submissions").insert(row).select("*").single();
    if (error) throw error;
    return rowOf(data)!;
  },

  async update(id, patch) {
    const { error } = await createAdminClient()
      .from("inquiry_submissions")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) throw error;
  },

  async get(id) {
    const { data, error } = await createAdminClient().from("inquiry_submissions").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return rowOf(data);
  },

  async findByTokenHash(tokenHash) {
    const { data, error } = await createAdminClient().from("inquiry_submissions").select("*").eq("verification_token_hash", tokenHash).maybeSingle();
    if (error) throw error;
    return rowOf(data);
  },

  async consumeToken(tokenHash, nowIso) {
    // Single UPDATE … WHERE … RETURNING: only one request can flip verified_at.
    const { data, error } = await createAdminClient()
      .from("inquiry_submissions")
      .update({ verified_at: nowIso, updated_at: nowIso })
      .eq("verification_token_hash", tokenHash)
      .is("verified_at", null)
      .gt("verification_expires_at", nowIso)
      .in("status", ["pending_verification", "needs_review"])
      .select("*");
    if (error) throw error;
    return rowOf((data ?? [])[0] ?? null);
  },

  async claimActivation(id, nowIso) {
    const { data, error } = await createAdminClient()
      .from("inquiry_submissions")
      .update({ activation_claimed_at: nowIso })
      .eq("id", id)
      .is("activation_claimed_at", null)
      .is("event_id", null)
      .select("id");
    if (error) throw error;
    return (data ?? []).length === 1;
  },

  async releaseActivationClaim(id) {
    await createAdminClient().from("inquiry_submissions").update({ activation_claimed_at: null }).eq("id", id).is("event_id", null);
  },

  async latestUnverifiedForEmail(emailNormalized, sinceIso) {
    const { data, error } = await createAdminClient()
      .from("inquiry_submissions")
      .select("*")
      .eq("email_normalized", emailNormalized)
      .is("verified_at", null)
      .in("status", ["pending_verification", "needs_review"])
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return rowOf(data);
  },

  async claimHold(slotStart, slotEnd, submissionId, expiresIso) {
    const { data, error } = await createAdminClient().rpc("claim_consultation_hold", {
      p_slot_start: slotStart,
      p_slot_end: slotEnd,
      p_submission: submissionId,
      p_expires: expiresIso
    });
    if (error) throw error;
    return data === true;
  },

  async releaseHold(submissionId) {
    await createAdminClient().from("consultation_holds").delete().eq("submission_id", submissionId);
  },

  async logEvent(action, details, submissionId, actor) {
    try {
      await createAdminClient()
        .from("security_events")
        .insert({ action, details, submission_id: submissionId ?? null, actor_user_id: actor?.userId ?? null, actor_label: actor?.label ?? null });
    } catch {
      // Logging must never break the request it describes.
    }
  }
};

/** Active (unexpired) consultation holds overlapping a day window — used by scheduler availability. */
export async function listActiveHolds(rangeStartIso: string, rangeEndIso: string) {
  const { data, error } = await createAdminClient()
    .from("consultation_holds")
    .select("slot_start, slot_end")
    .gt("expires_at", new Date().toISOString())
    .gte("slot_start", rangeStartIso)
    .lte("slot_start", rangeEndIso);
  if (error) {
    // Table not migrated yet: behave as before (no holds).
    if ((error as { code?: string }).code === "42P01") return [];
    throw error;
  }
  return data ?? [];
}
