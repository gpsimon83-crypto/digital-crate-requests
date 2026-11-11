/**
 * Single source of truth for which account roles count as "staff" (i.e. can
 * see /admin and /analytics). Previously this list was copy-pasted into
 * middleware.ts, require-admin.ts, and separately re-implemented in several
 * frontend pages as `role === "admin"` — which silently excluded "owner"
 * and "manager" accounts from admin-only UI (they could still reach /admin
 * by typing the URL directly, since the real gates checked all three roles;
 * they just never saw a link to it).
 */
export const STAFF_ROLES = ["owner", "admin", "manager"] as const;

export function isStaffRole(role: string | null | undefined): boolean {
  return !!role && (STAFF_ROLES as readonly string[]).includes(role);
}

/** Roles that may use the Inquiry Security dashboard and its actions. */
export const SECURITY_ADMIN_ROLES = ["owner", "admin"] as const;

export function isSecurityAdminRole(role: string | null | undefined): boolean {
  return !!role && (SECURITY_ADMIN_ROLES as readonly string[]).includes(role);
}

/**
 * The account's role. Read ONLY from app_metadata, which just the server
 * (service role) can write. user_metadata is editable by the signed-in
 * user from the browser, so it must never decide access. Existing roles
 * were copied across by migration 0045.
 */
export function accountRole(user: { app_metadata?: Record<string, unknown> | null } | null | undefined): string | undefined {
  const role = user?.app_metadata?.role;
  return typeof role === "string" ? role : undefined;
}
