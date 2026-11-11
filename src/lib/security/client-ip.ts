import { isIP } from "net";

/**
 * Works out the requesting client's address for rate limiting.
 *
 * TRUSTED_PROXY controls which header is trusted:
 * - "vercel" (default): Vercel's edge sets x-real-ip / x-forwarded-for and
 *   strips any value the client sent, so the first entry is reliable.
 * - "cloudflare": trust cf-connecting-ip (only when the site is behind Cloudflare).
 * - "none": trust no header (every request shares one bucket — use only locally).
 *
 * Returns "unknown" rather than throwing; callers hash the value.
 */
export function getClientIp(headers: Headers, mode: string = process.env.TRUSTED_PROXY || "vercel"): string {
  const pick = (v: string | null) => {
    const first = (v ?? "").split(",")[0].trim();
    return isIP(first) ? first : null;
  };
  if (mode === "cloudflare") return pick(headers.get("cf-connecting-ip")) ?? "unknown";
  if (mode === "none") return "unknown";
  return pick(headers.get("x-real-ip")) ?? pick(headers.get("x-forwarded-for")) ?? "unknown";
}

/** Same /64 for IPv6 users (one household or phone often rotates within it). */
export function ipBucket(ip: string): string {
  if (isIP(ip) === 6) return ip.split(":").slice(0, 4).join(":") + "::/64";
  return ip;
}
