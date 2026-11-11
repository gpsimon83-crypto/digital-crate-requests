import { createAdminClient } from "@/lib/supabase/admin";

export interface RateLimitDecision {
  allowed: boolean;
  hits: number;
  retryAfterSeconds: number;
}

/** Persistent counter store. Production uses Postgres (security_rate_limit_hit). */
export interface RateLimitStore {
  hit(bucket: string, limit: number, windowSeconds: number): Promise<RateLimitDecision>;
}

export const supabaseRateLimitStore: RateLimitStore = {
  async hit(bucket, limit, windowSeconds) {
    const db = createAdminClient();
    const { data, error } = await db.rpc("security_rate_limit_hit", { p_bucket: bucket, p_limit: limit, p_window_seconds: windowSeconds });
    if (error) throw error;
    const row = Array.isArray(data) ? data[0] : data;
    return { allowed: !!row?.allowed, hits: Number(row?.hits ?? 0), retryAfterSeconds: Number(row?.retry_after_seconds ?? windowSeconds) };
  }
};

function envInt(name: string, fallback: number) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

/** Starting limits. Each can be changed with the env var named in it. */
export function limits() {
  return {
    inquiryPerSource: { limit: envInt("RL_INQUIRY_PER_IP", 5), window: envInt("RL_INQUIRY_WINDOW_SECONDS", 15 * 60) },
    verifyEmailPerEmail: { limit: envInt("RL_VERIFY_EMAIL_PER_EMAIL", 3), window: 60 * 60 },
    verifyEmailPerSource: { limit: envInt("RL_VERIFY_EMAIL_PER_IP", 10), window: 60 * 60 },
    verifyAttemptPerSource: { limit: envInt("RL_VERIFY_ATTEMPTS_PER_IP", 30), window: 15 * 60 },
    consultationPerSource: { limit: envInt("RL_CONSULTATION_PER_IP", 5), window: 15 * 60 },
    djSignupPerSource: { limit: envInt("RL_SIGNUP_PER_IP", 5), window: 60 * 60 },
    ssoPerSource: { limit: envInt("RL_SSO_PER_IP", 20), window: 15 * 60 },
    publicWritePerSource: { limit: envInt("RL_PUBLIC_WRITE_PER_IP", 60), window: 15 * 60 },
    adminActionPerUser: { limit: envInt("RL_ADMIN_ACTIONS_PER_USER", 120), window: 15 * 60 }
  };
}

/**
 * Runs checks in order and stops at the first one that's over its limit
 * (later counters aren't incremented by a request that's already refused).
 */
export async function enforce(store: RateLimitStore, checks: { bucket: string; limit: number; window: number }[]): Promise<RateLimitDecision> {
  let last: RateLimitDecision = { allowed: true, hits: 0, retryAfterSeconds: 0 };
  for (const c of checks) {
    last = await store.hit(c.bucket, c.limit, c.window);
    if (!last.allowed) return last;
  }
  return last;
}

export function retryMessage(retryAfterSeconds: number): string {
  const mins = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts. Please wait about ${mins} minute${mins === 1 ? "" : "s"} and try again.`;
}
