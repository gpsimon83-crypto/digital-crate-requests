import { randomInt } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireAdmin } from "@/lib/require-admin";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I lookalikes
const newCode = () => `DCDJ-${Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("")}`;

/**
 * Account setup link for a DJ already in the DJ list: an invite code tied to
 * that DJ's profile, so signing up links the login to it (no duplicate DJ).
 * Reuses the DJ's unused code if there is one, so sending twice is safe.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  try {
    const db = createAdminClient();
    const { data: dj, error } = await db.from("djs").select("id, display_name, auth_user_id, signature_email").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!dj) return NextResponse.json({ error: "DJ not found" }, { status: 404 });
    if (dj.auth_user_id) return NextResponse.json({ error: `${dj.display_name} already has a login. If they forgot the password, they can use Forgot password on the sign-in page.` }, { status: 409 });
    const { data: existing } = await db.from("invite_codes").select("code").eq("assigned_dj_id", id).eq("used", false).limit(1).maybeSingle();
    let code = existing?.code as string | undefined;
    if (!code) {
      const { data: made, error: insErr } = await db.from("invite_codes").insert({ code: newCode(), assigned_dj_id: id }).select("code").single();
      if (insErr) throw insErr;
      code = made.code as string;
    }
    const origin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || req.nextUrl.origin;
    return NextResponse.json({ code, link: `${origin}/dj-dashboard/signup?code=${encodeURIComponent(code)}`, email: dj.signature_email ?? null, name: dj.display_name });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
