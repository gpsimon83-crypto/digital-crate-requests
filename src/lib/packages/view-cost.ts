import { createClient } from "@/lib/supabase/server";
import { resolveUserRole, hasPermission } from "@/lib/data/permissions";
import type { CatalogItemData } from "@/lib/packages/types";

/**
 * Whether the signed-in caller may see internal_cost_cents/margin figures.
 * Used to strip those fields server-side rather than hide them with CSS —
 * a manager without packages.view_cost should never receive the field at
 * all in the JSON response.
 */
export async function canViewCost(): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return false;
  const role = await resolveUserRole(user.id, user.user_metadata?.role);
  if (!role) return false;
  return hasPermission(role, "packages.view_cost");
}

export function stripCost<T extends { internal_cost_cents?: number | null }>(item: T): T {
  return { ...item, internal_cost_cents: null };
}

export function stripCostFromCatalog(items: CatalogItemData[], allowed: boolean): CatalogItemData[] {
  if (allowed) return items;
  return items.map(stripCost);
}
