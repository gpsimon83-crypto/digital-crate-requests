import { createAdminClient } from "@/lib/supabase/admin";
import { ROLES, type Role } from "@/lib/permission-capabilities";

export interface PermissionRow {
  role: string;
  capability: string;
}

export type { Role };

export async function listPermissions(): Promise<PermissionRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("permissions").select("role, capability");
  if (error) throw error;
  return data;
}

export async function grantPermission(role: string, capability: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("permissions").upsert({ role, capability, granted: true }, { onConflict: "role,capability" });
  if (error) throw error;
}

export async function revokePermission(role: string, capability: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("permissions").delete().eq("role", role).eq("capability", capability);
  if (error) throw error;
}

/**
 * Resolves the caller's role bucket the same way the rest of the app
 * already does: staff role from user_metadata, otherwise a `djs` row
 * linked to this auth user means "dj", otherwise a `clients` row means
 * "client". Mirrors the resolution in require-event-access.ts.
 */
export async function resolveUserRole(userId: string, metadataRole: string | null | undefined): Promise<Role | null> {
  if (metadataRole && (ROLES as readonly string[]).includes(metadataRole)) return metadataRole as Role;

  const db = createAdminClient();
  const { data: dj } = await db.from("djs").select("id").eq("auth_user_id", userId).maybeSingle();
  if (dj) return "dj";

  const { data: client } = await db.from("clients").select("id").eq("auth_user_id", userId).maybeSingle();
  if (client) return "client";

  return null;
}

export async function hasPermission(role: Role, capability: string): Promise<boolean> {
  const db = createAdminClient();
  const { data, error } = await db.from("permissions").select("granted").eq("role", role).eq("capability", capability).maybeSingle();
  if (error) throw error;
  return !!data?.granted;
}
