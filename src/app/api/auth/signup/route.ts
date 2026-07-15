import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Public, invite-code-gated DJ signup. Mirrors the admin "Create Login"
 * flow (src/app/api/admin/djs/[id]/create-login/route.ts) but is driven by
 * the DJ themselves using a code an admin generated in /admin/invite-codes,
 * and requires no admin session.
 */
export async function POST(req: NextRequest) {
  const { code, email, password, displayName } = await req.json().catch(() => ({}));

  if (!code || !email || !password || !displayName) {
    return NextResponse.json({ error: "Code, name, email, and password are all required." }, { status: 400 });
  }
  if (String(password).length < 8) {
    return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
  }

  try {
    const db = createAdminClient();

    const { data: settings } = await db
      .from("platform_settings")
      .select("allow_dj_self_registration")
      .eq("id", true)
      .maybeSingle();
    if (settings && settings.allow_dj_self_registration === false) {
      return NextResponse.json({ error: "Self-registration is currently disabled." }, { status: 403 });
    }

    const normalizedCode = String(code).trim().toUpperCase();
    const { data: invite, error: inviteError } = await db
      .from("invite_codes")
      .select("id, assigned_dj_id, used")
      .eq("code", normalizedCode)
      .maybeSingle();
    if (inviteError) throw inviteError;
    if (!invite) {
      return NextResponse.json({ error: "That invite code isn't valid." }, { status: 400 });
    }
    if (invite.used) {
      return NextResponse.json({ error: "That invite code has already been used." }, { status: 400 });
    }

    const { data: authUser, error: authError } = await db.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { dj_name: displayName },
    });
    if (authError) throw authError;

    if (invite.assigned_dj_id) {
      // Code was pre-assigned to a DJ record an admin already set up — link it.
      const { error: linkError } = await db
        .from("djs")
        .update({ auth_user_id: authUser.user.id, display_name: displayName })
        .eq("id", invite.assigned_dj_id);
      if (linkError) throw linkError;
    } else {
      // Generic code — create a fresh DJ record for this signup.
      const { error: createDjError } = await db
        .from("djs")
        .insert({ display_name: displayName, auth_user_id: authUser.user.id });
      if (createDjError) throw createDjError;
    }

    const { error: markUsedError } = await db
      .from("invite_codes")
      .update({ used: true })
      .eq("id", invite.id);
    if (markUsedError) throw markUsedError;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
