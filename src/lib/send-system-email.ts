import { Resend } from "resend";

/**
 * System-level transactional email — not tied to a specific DJ's
 * connected mailbox (see send-email.ts for that path, used by
 * automations once a DJ is assigned). This is for things that need to
 * go out before any DJ is involved, like the client's account-signup
 * invite right when an inquiry comes in. Sent through Resend from a
 * domain-verified address so it doesn't inherit the deliverability
 * problems of GoDaddy's default PHP mail() on the WordPress side.
 *
 * Soft no-op (returns null) if Resend isn't configured, so a missing
 * env var never breaks inquiry creation — same pattern as
 * sendInquiryAlertSms in send-sms.ts.
 */
export async function sendSystemEmail(message: { to: string | string[]; subject: string; text: string; replyTo?: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.SYSTEM_EMAIL_FROM;

  if (!apiKey || !from) return null;

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: message.to,
    subject: message.subject,
    text: message.text,
    replyTo: message.replyTo
  });

  if (error) throw new Error(error.message);
  return data?.id ?? null;
}
