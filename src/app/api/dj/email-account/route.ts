import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailAccountForDj, upsertEmailAccount, deleteEmailAccount } from "@/lib/data/email-accounts";
import { verifyAccountConnection } from "@/lib/send-email";
import { errorMessage } from "@/lib/error-message";

async function currentDjId() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return null;
  const db = createAdminClient();
  const { data: dj } = await db.from("djs").select("id").eq("auth_user_id", user.id).maybeSingle();
  return dj?.id ?? null;
}

export async function GET() {
  const djId = await currentDjId();
  if (!djId) return NextResponse.json({ error: "Your login isn't linked to a DJ profile." }, { status: 403 });

  try {
    const account = await getEmailAccountForDj(djId);
    return NextResponse.json({ account });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const djId = await currentDjId();
  if (!djId) return NextResponse.json({ error: "Your login isn't linked to a DJ profile." }, { status: 403 });

  const body = await req.json();
  const { emailAddress, smtpHost, smtpPort, imapHost, imapPort, password } = body as {
    emailAddress?: string;
    smtpHost?: string;
    smtpPort?: number;
    imapHost?: string;
    imapPort?: number;
    password?: string;
  };

  if (!emailAddress || !smtpHost || !smtpPort || !imapHost || !imapPort || !password) {
    return NextResponse.json({ error: "All fields are required." }, { status: 400 });
  }

  try {
    // Verify the credentials actually work before saving them.
    await verifyAccountConnection({
      djId,
      emailAddress,
      smtpHost,
      smtpPort,
      imapHost,
      imapPort,
      password,
      lastCheckedAt: null
    });

    await upsertEmailAccount({ djId, emailAddress, smtpHost, smtpPort, imapHost, imapPort, password });
    const account = await getEmailAccountForDj(djId);
    return NextResponse.json({ account });
  } catch (err) {
    return NextResponse.json({ error: `Couldn't connect with those settings — ${errorMessage(err)}` }, { status: 400 });
  }
}

export async function DELETE() {
  const djId = await currentDjId();
  if (!djId) return NextResponse.json({ error: "Your login isn't linked to a DJ profile." }, { status: 403 });

  try {
    await deleteEmailAccount(djId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
