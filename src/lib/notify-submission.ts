import { createAdminClient } from "@/lib/supabase/admin";
import { sendSystemEmail } from "@/lib/send-system-email";
import { STAFF_ROLES } from "@/lib/roles";

function opsEmailList(): string[] {
  return (process.env.OPS_ALERT_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

async function notifyStaff(input: { type: string; title: string; body: string; eventId: string }) {
  const db = createAdminClient();
  const { data } = await db.auth.admin.listUsers({ perPage: 200 });
  const staffIds = (data?.users ?? []).filter((u) => STAFF_ROLES.includes(u.user_metadata?.role)).map((u) => u.id);
  if (staffIds.length === 0) return;

  const { error } = await db.from("notifications").insert(
    staffIds.map((userId) => ({
      user_id: userId,
      type: input.type,
      title: input.title,
      body: input.body,
      entity_type: "event",
      entity_id: input.eventId,
      event_id: input.eventId
    }))
  );
  if (error) throw error;
}

/**
 * A failed email must never be silent: the in-app bell doesn't depend on
 * the email service, so it's where staff find out someone needs a manual
 * follow-up. Never throws.
 */
export async function flagDeliveryFailure(input: { eventId: string; title: string; body: string }) {
  try {
    await notifyStaff({ type: "delivery_failed", ...input });
  } catch (err) {
    console.error("could not record delivery failure for event", input.eventId, err);
  }
}

/**
 * Sends a client-facing email and treats "email service not configured"
 * the same as a send error: logged, and flagged in the bell so staff can
 * follow up by hand. Returns whether it actually went out. Never throws.
 */
export async function sendTrackedEmail(input: {
  to: string | string[];
  subject: string;
  text: string;
  eventId: string;
  failureTitle: string;
  /** Set on client-facing emails: bookings@ has no mailbox, so replies go to the alert addresses instead. */
  repliesToStaff?: boolean;
}): Promise<boolean> {
  const recipients = Array.isArray(input.to) ? input.to.join(", ") : input.to;
  try {
    const replyTo = input.repliesToStaff ? opsEmailList() : [];
    const id = await sendSystemEmail({ to: input.to, subject: input.subject, text: input.text, replyTo: replyTo.length > 0 ? replyTo : undefined });
    if (!id) throw new Error("the email service isn't configured on the live site");
    return true;
  } catch (err) {
    const reason = err instanceof Error ? err.message : "unknown error";
    console.error("tracked email failed for event", input.eventId, input.subject, err);
    await flagDeliveryFailure({
      eventId: input.eventId,
      title: input.failureTitle,
      body: `To: ${recipients} — ${reason}. Follow up with them directly.`
    });
    return false;
  }
}

/**
 * Alerts staff that a public form was submitted: an in-app notification
 * for every staff user plus an email to OPS_ALERT_EMAILS. Each channel
 * fails independently and loudly so one broken channel never hides the
 * others or breaks the submission itself.
 */
export async function alertStaffOfSubmission(input: { title: string; body: string; eventId: string; origin: string }) {
  try {
    await notifyStaff({ type: "lead", title: input.title, body: input.body, eventId: input.eventId });
  } catch (err) {
    console.error("in-app submission alert failed for event", input.eventId, err);
  }

  const opsEmails = opsEmailList();

  if (opsEmails.length === 0) {
    console.error("OPS_ALERT_EMAILS is not set — no email alert sent for event", input.eventId);
    await flagDeliveryFailure({
      eventId: input.eventId,
      title: "Alert emails aren't set up",
      body: "A new submission came in but no alert email address is configured on the live site (OPS_ALERT_EMAILS)."
    });
    return;
  }

  await sendTrackedEmail({
    to: opsEmails,
    subject: input.title,
    text: `${input.body}\n\nView in the admin: ${input.origin}/admin/events/${input.eventId}`,
    eventId: input.eventId,
    failureTitle: "Alert email didn't send"
  });
}
