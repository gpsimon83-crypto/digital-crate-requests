/**
 * Only same-site paths are allowed as post-login destinations. Rejects
 * absolute URLs, protocol-relative "//evil.com", backslash tricks and
 * anything that isn't a plain path, so a crafted ?next= can't send someone
 * to another website after they sign in.
 */
export function safeNextPath(next: string | null | undefined, fallback: string, allowedPrefixes?: string[]): string {
  if (!next || typeof next !== "string") return fallback;
  let v: string;
  try {
    v = decodeURIComponent(next);
  } catch {
    return fallback;
  }
  if (!v.startsWith("/") || v.startsWith("//") || v.startsWith("/\\") || v.includes("\\")) return fallback;
  if (/[\u0000-\u001F\u007F]/.test(v) || /^\/[a-z][a-z0-9+.-]*:/i.test(v)) return fallback;
  if (allowedPrefixes && !allowedPrefixes.some((p) => v === p || v.startsWith(p.endsWith("/") ? p : `${p}/`) || v.startsWith(`${p}?`))) return fallback;
  return v;
}
