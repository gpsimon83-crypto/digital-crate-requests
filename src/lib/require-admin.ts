import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STAFF_ROLES = ["owner", "admin", "manager"];

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

  if (!user || !STAFF_ROLES.includes(user.user_metadata?.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  return null;
}
