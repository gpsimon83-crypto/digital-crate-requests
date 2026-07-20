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
