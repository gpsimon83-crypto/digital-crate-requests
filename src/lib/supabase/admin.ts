import { createClient } from "@supabase/supabase-js";

/**
 * Service-role client for server-only API routes. Bypasses RLS, so this
 * must never be imported into client components. Add RLS policies before
 * exposing any of this data through user-scoped clients.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase is not configured yet. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local."
    );
  }

  return createClient(url, key, { auth: { persistSession: false } });
}
