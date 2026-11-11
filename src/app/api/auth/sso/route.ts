import { createHmac, timingSafeEqual } from "crypto";
import { safeNextPath } from "@/lib/security/safe-redirect";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforce, limits, supabaseRateLimitStore } from "@/lib/security/rate-limit";
import { keyedHash, sha256Hex } from "@/lib/security/crypto";
import { getClientIp } from "@/lib/security/client-ip";

const MAX_AGE_SECONDS = 600;

function verifySignature(email: string, ts: string, sig: string): boolean {
  const secret = process.env.SSO_SHARED_SECRET;
  if (!secret) return false;
  const expected = createHmac("sha256", secret).update(`${email}|${ts}`).digest("hex");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(sig, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * SSO bridge: WordPress (Members portal) signs a short-lived token for the
 * already-logged-in DJ and links here instead of showing this app's own
 * login form. We verify the signature, then use the Supabase admin API to
 * mint a magic-link token for that email and hand the browser off to
 * /auth/callback to exchange it for a real session.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const email = searchParams.get("email");
  const ts = searchParams.get("ts");
  const sig = searchParams.get("sig");
  const djName = searchParams.get("dj_name") ?? undefined;
  const next = safeNextPath(searchParams.get("next"), "/dj-dashboard");

  if (!email || !ts || !sig) {
    return NextResponse.redirect(new URL("/dj-dashboard/login?error=sso_missing", origin));
  }

  const age = Math.abs(Date.now() / 1000 - Number(ts));
  if (!Number.isFinite(age) || age > MAX_AGE_SECONDS) {
    return NextResponse.redirect(new URL("/dj-dashboard/login?error=sso_expired", origin));
  }

  if (!verifySignature(email, ts, sig)) {
    return NextResponse.redirect(new URL("/dj-dashboard/login?error=sso_invalid", origin));
  }

  const supabase = createAdminClient();

  // Each signed link works once (a copied or logged URL can't be replayed),
  // and per-visitor attempts are limited.
  const L = limits();
  const rl = await enforce(supabaseRateLimitStore, [
    { bucket: `sso:s:${keyedHash("ip", getClientIp(request.headers))}`, limit: L.ssoPerSource.limit, window: L.ssoPerSource.window }
  ]).catch(() => ({ allowed: true }));
  if (!rl.allowed) return NextResponse.redirect(new URL("/dj-dashboard/login?error=sso_failed", origin));
  const { error: usedError } = await supabase.from("security_used_tokens").insert({ token_hash: sha256Hex(`sso:${sig}`), purpose: "sso" });
  if (usedError && usedError.code === "23505") {
    return NextResponse.redirect(new URL("/dj-dashboard/login?error=sso_expired", origin));
  }

  const { data, error } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email,
    options: {
      data: djName ? { dj_name: djName } : undefined,
      redirectTo: new URL(`/auth/callback?next=${encodeURIComponent(next)}`, origin).toString(),
    },
  });

  if (error || !data?.properties?.action_link) {
    return NextResponse.redirect(new URL("/dj-dashboard/login?error=sso_failed", origin));
  }

  return NextResponse.redirect(data.properties.action_link);
}
