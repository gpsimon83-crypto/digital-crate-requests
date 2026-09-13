import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/** Resolves the signed-in user's own djs.id, or null if not signed in / not a DJ. */
export async function getOwnDjId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = createAdminClient();
  const { data } = await db.from("djs").select("id").eq("auth_user_id", user.id).maybeSingle();
  return data?.id ?? null;
}
