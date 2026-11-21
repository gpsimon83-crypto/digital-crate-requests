import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireAdmin } from "@/lib/require-admin";

/**
 * "This DJ is me": links the signed-in staff login to a DJ profile, so a
 * staff member who also DJs (DJ Peace) sees their own gigs. Never takes over
 * a profile that already has a login, and one login links to one DJ.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const db = createAdminClient();
    const { data: dj, error } = await db.from("djs").select("id, display_name, auth_user_id").eq("id", id).maybeSingle();
    if (error) throw error;
    if (!dj) return NextResponse.json({ error: "DJ not found" }, { status: 404 });
    if (dj.auth_user_id === user.id) return NextResponse.json({ linked: true });
    if (dj.auth_user_id) return NextResponse.json({ error: `${dj.display_name} already has their own login. Unlink it there first if this profile is really yours.` }, { status: 409 });
    const { data: other } = await db.from("djs").select("display_name").eq("auth_user_id", user.id).maybeSingle();
    if (other) return NextResponse.json({ error: `Your login is already linked to ${other.display_name}. Unlink that first.` }, { status: 409 });
    const { error: upErr } = await db.from("djs").update({ auth_user_id: user.id }).eq("id", id).is("auth_user_id", null);
    if (upErr) throw upErr;
    return NextResponse.json({ linked: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

/** Undo "This DJ is me" (only your own link). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  try {
    const db = createAdminClient();
    const { error } = await db.from("djs").update({ auth_user_id: null }).eq("id", id).eq("auth_user_id", user.id);
    if (error) throw error;
    return NextResponse.json({ linked: false });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
