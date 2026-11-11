import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { accountRole, isSecurityAdminRole } from "@/lib/roles";
import type { Actor } from "@/lib/security/inquiry-types";
import { staffSessionMeetsMfa } from "@/lib/security/mfa";

export type SecurityAdminCheck =
  | { ok: true; actor: Actor; userId: string; aal: string | null }
  | { ok: false; response: NextResponse };

/**
 * Owner/admin only (role from app_metadata). The session must have passed
 * two-factor when the account has it set up (always required when
 * ADMIN_MFA_REQUIRED=true).
 */
export async function requireSecurityAdmin(): Promise<SecurityAdminCheck> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, response: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  if (!isSecurityAdminRole(accountRole(user))) {
    return { ok: false, response: NextResponse.json({ error: "Owner or admin access required" }, { status: 403 }) };
  }
  if (!(await staffSessionMeetsMfa(supabase))) {
    return { ok: false, response: NextResponse.json({ error: "Two-factor verification required", mfa: true }, { status: 403 }) };
  }
  let aal: string | null = null;
  try {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    aal = data?.currentLevel ?? null;
  } catch {
    aal = null;
  }
  const label = user.email || "admin";
  return { ok: true, actor: { userId: user.id, label }, userId: user.id, aal };
}
