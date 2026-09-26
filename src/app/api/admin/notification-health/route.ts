import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/require-admin";
import { sendSystemEmail } from "@/lib/send-system-email";

function opsRecipients(): string[] {
  return (process.env.OPS_ALERT_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/** Booleans only — never returns a key, token, or secret. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  return NextResponse.json({
    email: {
      apiKeySet: !!process.env.RESEND_API_KEY,
      fromSet: !!process.env.SYSTEM_EMAIL_FROM,
      from: process.env.SYSTEM_EMAIL_FROM ?? null,
      alertRecipients: opsRecipients().length
    },
    sms: {
      twilioSet: !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER),
      alertPhoneSet: !!process.env.OPS_ALERT_PHONE_NUMBER
    }
  });
}

/**
 * Sends a real, clearly-labelled test through the same path client
 * confirmations and staff alerts use, to the signed-in admin plus the
 * configured alert addresses, and reports the email service's own error
 * text if it refuses (e.g. an unverified sending domain).
 */
export async function POST() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  const recipients = [...new Set([user?.email, ...opsRecipients()].filter((e): e is string => !!e))];
  if (recipients.length === 0) return NextResponse.json({ ok: false, error: "No email address to send the test to." });

  try {
    const id = await sendSystemEmail({
      to: recipients,
      subject: "Test — Digital Crate DJs email alerts",
      text: "This is a test from the Settings page of your Digital Crate DJs admin. If you're reading it, confirmation and alert emails can reach you. No action needed."
    });
    if (!id) return NextResponse.json({ ok: false, error: "The email service isn't configured on the live site (missing API key or sender address)." });
    return NextResponse.json({ ok: true, recipients });
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Unknown error" });
  }
}
