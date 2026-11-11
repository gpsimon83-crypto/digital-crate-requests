import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { staffSessionMeetsMfa } from "@/lib/security/mfa";
import { isStaffRole, accountRole } from "@/lib/roles";

/**
 * Guards mutating admin API routes. The /admin/* pages are protected by
 * middleware, but the /api/admin/* routes are a different path prefix and
 * were reachable directly without this check.
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !isStaffRole(accountRole(user))) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  if (!(await staffSessionMeetsMfa(supabase))) {
    return NextResponse.json({ error: "Two-factor verification required", mfa: true }, { status: 403 });
  }

  return null;
}
