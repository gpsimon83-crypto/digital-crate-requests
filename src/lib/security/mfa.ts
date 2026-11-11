import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Staff sessions must have passed two-factor when the account has an
 * authenticator set up, or for everyone when ADMIN_MFA_REQUIRED=true.
 * Returns true when the session is acceptable.
 */
export async function staffSessionMeetsMfa(supabase: SupabaseClient): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error || !data) return process.env.ADMIN_MFA_REQUIRED !== "true";
    if (data.currentLevel === "aal2") return true;
    if (data.nextLevel === "aal2") return false;
    return process.env.ADMIN_MFA_REQUIRED !== "true";
  } catch {
    return process.env.ADMIN_MFA_REQUIRED !== "true";
  }
}
