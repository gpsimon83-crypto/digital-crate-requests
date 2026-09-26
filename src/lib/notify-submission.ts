import { createAdminClient } from "@/lib/supabase/admin";
import { sendSystemEmail } from "@/lib/send-system-email";
import { STAFF_ROLES } from "@/lib/roles";

/**
 * Alerts staff that a public form was submitted: an in-app notification
 * for every staff user plus an email to OPS_ALERT_EMAILS. Each channel
 * fails independently and loudly (console.error → Vercel logs) so one
 * broken channel never hides the others or breaks the submission itself.
 */
export async function alertStaffOfSubmission(input: { title: string; body: string; eventId: string; origin: string }) {
  try {
    const db = createAdminClient();
    const { data } = await db.auth.admin.listUsers({ perPage: 200 });
    const staffIds = (data?.users ?? []).filter((u) => STAFF_ROLES.includes(u.user_metadata?.role)).map((u) => u.id);
    if (staffIds.length > 0) {
      const { error } = await db.from("notifications").insert(
        staffIds.map((userId) => ({
          user_id: userId,
          type: "lead",
          title: input.title,
          body: input.body,
          entity_type: "event",
          entity_id: input.eventId,
          event_id: input.eventId
        }))
      );
      if (error) throw error;
    }
  } catch (err) {
    console.error("in-app submission alert failed for event", input.eventId, err);
  }

  try {
    const opsEmails = (process.env.OPS_ALERT_EMAILS ?? "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (opsEmails.length === 0) {
      console.error("OPS_ALERT_EMAILS is not set — no email alert sent for event", input.eventId);
      return;
    }
    await sendSystemEmail({
      to: opsEmails,
      subject: input.title,
      text: `${input.body}\n\nView in the admin: ${input.origin}/admin/events/${input.eventId}`
    });
  } catch (err) {
    console.error("ops alert email failed for event", input.eventId, err);
  }
}
