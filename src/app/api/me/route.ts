import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const role = (user.user_metadata?.role as string | undefined) ?? "dj";

  // The djs table link is best-effort: if the auth_user_id column hasn't
  // been added yet, still return the role so admin access keeps working.
  let dj = null;
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("djs")
      .select("id, display_name, photo_url")
      .eq("auth_user_id", user.id)
      .maybeSingle();
    dj = data;
  } catch {
    dj = null;
  }

  return NextResponse.json({ user: { id: user.id, email: user.email, role }, dj });
}
