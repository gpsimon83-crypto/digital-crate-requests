import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";

/** SHA-256 hex. Used for storing one-time tokens (never the raw token). */
export function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

/** 256-bit URL-safe random token. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashSecretConfigured(): boolean {
  return !!process.env.SECURITY_HASH_SECRET && process.env.SECURITY_HASH_SECRET.length >= 32;
}

/**
 * Keyed hash for identifiers we only need to compare (IP addresses, email
 * addresses for blocks and rate limits). Keeps raw IPs out of the database.
 * Without SECURITY_HASH_SECRET it still works (plain SHA-256 with a label),
 * and the admin dashboard shows a setup warning.
 */
export function keyedHash(purpose: string, value: string): string {
  const secret = process.env.SECURITY_HASH_SECRET;
  if (secret) return createHmac("sha256", secret).update(`${purpose}:${value}`).digest("hex");
  return sha256Hex(`dcdj:${purpose}:${value}`);
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/**
 * Lower-cased, trimmed email used for duplicate detection and limits. For
 * Gmail, dots and +tags are ignored (the same inbox); other providers only
 * have +tags stripped. Only used for matching — the address as typed is
 * what we email.
 */
export function normalizeEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return e;
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  const plus = local.indexOf("+");
  if (plus > 0) local = local.slice(0, plus);
  if (domain === "gmail.com") local = local.replace(/\./g, "");
  return `${local}@${domain}`;
}

/** "j•••@gmail.com" — for admin screens and logs. */
export function maskEmail(email: string): string {
  const e = email.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return "•••";
  return `${e[0]}•••@${e.slice(at + 1)}`;
}

/** Collapses whitespace/case so trivially re-typed copies of a message match. */
export function messageFingerprint(text: string | null | undefined): string | null {
  const t = (text ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  if (t.length < 20) return null; // short messages ("hi") collide innocently
  return sha256Hex(`msg:${t}`);
}
