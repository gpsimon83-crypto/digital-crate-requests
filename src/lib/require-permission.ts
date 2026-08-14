import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
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

  const role = await resolveUserRole(user.id, user.user_metadata?.role);
  if (!role || !(await hasPermission(role, capability))) {
    return NextResponse.json({ error: "You don't have permission to do that" }, { status: 403 });
  }

  return null;
}
