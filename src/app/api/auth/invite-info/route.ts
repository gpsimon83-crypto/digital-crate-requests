import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enforce, limits, supabaseRateLimitStore } from "@/lib/security/rate-limit";
import { keyedHash } from "@/lib/security/crypto";
import { getClientIp } from "@/lib/security/client-ip";

/**
 * For the sign-up page: whether an invite code is a setup link for an
 * existing DJ profile, and that DJ's name ("Setting up DJ Penny's account").
 * Says nothing else, and is rate limited like sign-up itself.
 */
export async function GET(req: NextRequest) {
  const L = limits();
  const rl = await enforce(supabaseRateLimitStore, [
    { bucket: `dj-invite-info:s:${keyedHash("ip", getClientIp(req.headers))}`, limit: L.djSignupPerSource.limit * 4, window: L.djSignupPerSource.window }
  ]).catch(() => ({ allowed: true, retryAfterSeconds: 0 }));
  if (!rl.allowed) return NextResponse.json({ dj: null }, { status: 429 });
  const code = (req.nextUrl.searchParams.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,40}$/.test(code)) return NextResponse.json({ dj: null });
  try {
    const db = createAdminClient();
    const { data } = await db.from("invite_codes").select("used, djs(display_name)").eq("code", code).maybeSingle();
    const row = data as { used: boolean; djs: { display_name: string } | { display_name: string }[] | null } | null;
    const dj = row && !row.used ? (Array.isArray(row.djs) ? row.djs[0] : row.djs) : null;
    return NextResponse.json({ dj: dj ? { display_name: dj.display_name } : null });
  } catch {
    return NextResponse.json({ dj: null });
  }
}
