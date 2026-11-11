import { NextResponse } from "next/server";
import { accountRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { staffSessionMeetsMfa } from "@/lib/security/mfa";
import { isStaffRole } from "@/lib/roles";
import { resolveUserRole, hasPermission } from "@/lib/data/permissions";

/**
 * Capability-based gate, additive alongside requireAdmin/requireEventAccess
 * — not a replacement. Used only where a route explicitly needs finer
 * granularity than "is staff" (today, just the permissions matrix itself).
 */
export async function requirePermission(capability: string): Promise<NextResponse | null> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const role = await resolveUserRole(user.id, accountRole(user));
  if (role && isStaffRole(role) && !(await staffSessionMeetsMfa(supabase))) {
    return NextResponse.json({ error: "Two-factor verification required", mfa: true }, { status: 403 });
  }
  if (!role || !(await hasPermission(role, capability))) {
    return NextResponse.json({ error: "You don't have permission to do that" }, { status: 403 });
  }

  return null;
}
