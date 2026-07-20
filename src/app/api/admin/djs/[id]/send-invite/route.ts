import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireAdmin } from "@/lib/require-admin";

/**
 * Alternative to "Create Login" (which hands the admin a one-time temp
 * password to copy/paste to the DJ). This instead emails the DJ directly
 * via Supabase Auth's invite flow, landing them on a page where they set
 * their own password — no code or password ever passes through the admin.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  const { email } = await req.json();

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 });
  }

  try {
    const db = createAdminClient();
    const { data, error } = await db.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${req.nextUrl.origin}/dj-dashboard`,
    });
    if (error) throw error;

    const { error: linkError } = await db
      .from("djs")
      .update({ auth_user_id: data.user.id })
      .eq("id", id);
    if (linkError) throw linkError;

    return NextResponse.json({ email });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
