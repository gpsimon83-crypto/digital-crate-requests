/**
 * Portal access for a DJ on the roster: whether their DJ profile has a
 * working login for the DJ portal. Not online presence. Worked out from the
 * records that already decide access (nothing is changed to fit a label):
 *
 * - active:     a login is linked, it exists, and isn't blocked, and the DJ
 *               has signed in or confirmed their email
 * - invited:    a login is linked from Send invite, but the DJ hasn't
 *               accepted it yet (never signed in, email not confirmed)
 * - disabled:   the linked login is blocked (banned) in Supabase Auth
 * - missing:    the profile points at a login that no longer exists
 * - setup_sent: no login yet, but a setup link (invite code) is waiting
 * - none:       no login and no setup link
 */
export type PortalAccess = "active" | "invited" | "disabled" | "missing" | "setup_sent" | "none";

export type AuthUserLike = {
  id: string;
  invited_at?: string | null;
  email_confirmed_at?: string | null;
  confirmed_at?: string | null;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
};

export function portalAccess(dj: { auth_user_id: string | null }, user: AuthUserLike | null | undefined, hasSetupCode: boolean, now = Date.now()): PortalAccess {
  if (!dj.auth_user_id) return hasSetupCode ? "setup_sent" : "none";
  if (!user) return "missing";
  if (user.banned_until && Date.parse(user.banned_until) > now) return "disabled";
  if (!user.last_sign_in_at && !(user.email_confirmed_at ?? user.confirmed_at) && user.invited_at) return "invited";
  return "active";
}

export const ACCESS_LABEL: Record<PortalAccess, string> = {
  active: "Portal active",
  invited: "Invite sent",
  disabled: "Access disabled",
  missing: "Login missing",
  setup_sent: "Setup link sent",
  none: "Not connected"
};

export const ACCESS_HELP: Record<PortalAccess, string> = {
  active: "Has a working login for the DJ portal",
  invited: "Invited by email; hasn't accepted yet",
  disabled: "Their login is blocked",
  missing: "Linked to a login that no longer exists",
  setup_sent: "A setup link is waiting to be used",
  none: "No portal login yet"
};

/** The three filters the roster offers, and which states each covers. */
export type AccessFilter = "all" | "active" | "pending" | "none";
export function inFilter(a: PortalAccess, f: AccessFilter) {
  if (f === "all") return true;
  if (f === "active") return a === "active";
  if (f === "pending") return a === "invited" || a === "setup_sent" || a === "disabled" || a === "missing";
  return a === "none";
}
