/**
 * Cloudflare Turnstile server-side verification.
 *
 * Never reports success unless Cloudflare said so for this exact token:
 * a missing secret is "not_configured" (the request is refused), not a pass.
 */

export const TURNSTILE_ACTIONS = {
  inquiry: "inquiry",
  consultation: "consultation",
  resend: "resend_verification",
  dj_signup: "dj_signup"
} as const;

export type TurnstileFailure = "not_configured" | "missing" | "invalid" | "expired_or_reused" | "hostname" | "action" | "unavailable";
export type TurnstileResult = { ok: true } | { ok: false; reason: TurnstileFailure };

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return !!env.TURNSTILE_SECRET_KEY && !!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
}

export function allowedHostnames(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.TURNSTILE_ALLOWED_HOSTNAMES || "cratesdjs.com,www.cratesdjs.com,requests.digitalcratedjs.com")
    .split(",")
    .map((h) => h.trim().toLowerCase())
    .filter(Boolean);
}

export async function verifyTurnstile(input: {
  token: string | null | undefined;
  ip?: string;
  expectedAction: string;
  env?: NodeJS.ProcessEnv;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<TurnstileResult> {
  const env = input.env ?? process.env;
  const secret = env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: false, reason: "not_configured" };

  const token = (input.token ?? "").trim();
  if (!token) return { ok: false, reason: "missing" };
  if (token.length > 2048) return { ok: false, reason: "invalid" };

  const body = new URLSearchParams({ secret, response: token });
  if (input.ip && input.ip !== "unknown") body.set("remoteip", input.ip);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), input.timeoutMs ?? 8000);
  let data: { success?: boolean; "error-codes"?: string[]; hostname?: string; action?: string };
  try {
    const res = await (input.fetchImpl ?? fetch)(SITEVERIFY, { method: "POST", body, signal: controller.signal });
    if (!res.ok) return { ok: false, reason: "unavailable" };
    data = await res.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  } finally {
    clearTimeout(timer);
  }

  const codes = data["error-codes"] ?? [];
  if (!data.success) {
    if (codes.includes("timeout-or-duplicate")) return { ok: false, reason: "expired_or_reused" };
    if (codes.includes("missing-input-response")) return { ok: false, reason: "missing" };
    if (codes.includes("internal-error")) return { ok: false, reason: "unavailable" };
    if (codes.includes("missing-input-secret") || codes.includes("invalid-input-secret")) return { ok: false, reason: "not_configured" };
    return { ok: false, reason: "invalid" };
  }

  const hosts = allowedHostnames(env);
  if (data.hostname && hosts.length && !hosts.includes(data.hostname.toLowerCase())) return { ok: false, reason: "hostname" };
  if (data.action !== undefined && data.action !== input.expectedAction) return { ok: false, reason: "action" };
  return { ok: true };
}

/** What a visitor sees. Never exposes the internal reason. */
export function turnstileMessage(reason: TurnstileFailure): string {
  if (reason === "unavailable" || reason === "not_configured") {
    return "We couldn't complete the security check right now. Please wait a moment and try again, or call or email us.";
  }
  if (reason === "expired_or_reused" || reason === "missing") {
    return "The security check expired. Please complete it again and resubmit.";
  }
  return "We couldn't verify the security check. Please refresh the page and try again.";
}
