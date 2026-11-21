import { NextResponse } from "next/server";
import { accountRole } from "@/lib/roles";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { djRowForUser, viewAsDjId } from "@/lib/view-as";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let role = accountRole(user) ?? "dj";

  // The djs table link is best-effort: if the auth_user_id column hasn't
  // been added yet, still return the role so admin access keeps working.
  let dj = null;
  let viewAs: { id: string; display_name: string } | null = null;
  try {
    const db = createAdminClient();
    const viewing = await viewAsDjId(db, user);
    dj = await djRowForUser<{ id: string; display_name: string; photo_url: string | null }>(db, user.id, "id, display_name, photo_url");
    // View as DJ: pages see a DJ login (so they show the DJ's view), flagged so they can say so.
    if (viewing && dj) {
      viewAs = { id: dj.id, display_name: dj.display_name };
      role = "dj";
    }
  } catch {
    dj = null;
  }

  return NextResponse.json({ user: { id: user.id, email: viewAs ? null : user.email, role }, dj, viewAs });
}
