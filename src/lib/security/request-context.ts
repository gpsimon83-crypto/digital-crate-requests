import { isIP } from "net";
import { getClientIp } from "@/lib/security/client-ip";
import { safeEqual } from "@/lib/security/crypto";

/**
 * Server-to-server submissions from the WordPress site (digitalcratedjs.com)
 * authenticate with a shared secret instead of a Turnstile token, and pass
 * the visitor's address so per-visitor limits still apply. Without a
 * configured secret (32+ characters) this always returns false.
 */
export function isPartnerRequest(headers: Headers, env: NodeJS.ProcessEnv = process.env): boolean {
  const secret = env.INQUIRY_PARTNER_SECRET;
  const given = headers.get("x-dcdj-partner-key");
  if (!secret || secret.length < 32 || !given) return false;
  return safeEqual(given, secret);
}

export function requestContext(headers: Headers) {
  const partner = isPartnerRequest(headers);
  let ip = getClientIp(headers);
  if (partner) {
    const forwarded = (headers.get("x-dcdj-client-ip") ?? "").trim();
    ip = isIP(forwarded) ? forwarded : "partner-unknown";
  }
  return { partner, ip };
}

/** Parses a JSON body without throwing (bad JSON is a 400, not a 500). */
export async function readJson(req: Request): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 64 * 1024) return null;
  try {
    const text = await req.text();
    if (text.length > 64 * 1024) return null;
    return JSON.parse(text);
  } catch {
    return null;
  }
}
