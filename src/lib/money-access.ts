import { createClient } from "@/lib/supabase/server";
import { accountRole, isStaffRole } from "@/lib/roles";
import { hasPermission, resolveUserRole } from "@/lib/data/permissions";

/**
 * Who may see and change the internal money side (DJ payout rules, company
 * share, band fees): `finance.view_company` to see, `finance.manage` to
 * change. Owners and admins have both by default; managers can see.
 * Call after requireAdmin().
 */
export async function moneyAccess(): Promise<{ userId: string | null; view: boolean; manage: boolean }> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return { userId: null, view: false, manage: false };
  const role = await resolveUserRole(user.id, accountRole(user));
  if (!role || !isStaffRole(role)) return { userId: user.id, view: false, manage: false };
  const [view, manage] = await Promise.all([hasPermission(role, "finance.view_company").catch(() => false), hasPermission(role, "finance.manage").catch(() => false)]);
  return { userId: user.id, view: view || manage, manage };
}
