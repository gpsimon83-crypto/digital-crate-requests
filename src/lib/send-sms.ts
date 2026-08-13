import twilio from "twilio";

function formatEventDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getUTCFullYear()}`;
}

/**
 * Fires the internal ops alert described in our A2P 10DLC campaign
 * registration: a single, software-generated SMS to our own business
 * phone whenever the public inquiry form is submitted — never to a
 * customer, never conversational. Message wording intentionally matches
 * the sample submitted for carrier approval; don't drift from this
 * template without re-registering the campaign.
 *
 * Soft no-op (returns null) if Twilio isn't configured, so a missing env
 * var never breaks inquiry creation — the SMS alert is a convenience on
 * top of the saved booking data, not a requirement for it.
 */
export async function sendInquiryAlertSms(input: { name: string; eventDate: string; eventType: string; djName?: string | null }) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  const toNumber = process.env.OPS_ALERT_PHONE_NUMBER;

  if (!accountSid || !authToken || !fromNumber || !toNumber) return null;

  const client = twilio(accountSid, authToken);
  const body = `Digital Crate DJs: New booking request – ${input.name}. Event date ${formatEventDate(input.eventDate)} · ${input.eventType}. Preferred DJ: ${input.djName || "No preference"}. Check your email for full details. digitalcratedjs.com Reply STOP to opt out.`;

  const message = await client.messages.create({ from: fromNumber, to: toNumber, body });
  return message.sid;
}
