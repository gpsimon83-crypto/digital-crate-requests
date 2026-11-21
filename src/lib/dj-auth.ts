import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { djRowForUser } from "@/lib/view-as";

/** Resolves the signed-in user's own djs.id, or null if not signed in / not a DJ. */
export async function getOwnDjId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const db = createAdminClient();
  const data = await djRowForUser(db, user.id);
  return data?.id ?? null;
}
