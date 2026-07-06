import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireAdmin } from "@/lib/require-admin";

function generateTempPassword() {
  return `Crate-${Math.random().toString(36).slice(2, 8)}-${Math.random().toString(36).slice(2, 6)}`;
}

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
    const tempPassword = generateTempPassword();

    const { data: authUser, error: authError } = await db.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (authError) throw authError;

    const { error: linkError } = await db
      .from("djs")
      .update({ auth_user_id: authUser.user.id })
      .eq("id", id);
    if (linkError) throw linkError;

    return NextResponse.json({ email, tempPassword });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
