import { createInquiry } from "@/lib/data/inquiries";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendInquiryAlertSms } from "@/lib/send-sms";
import { logActivity } from "@/lib/activity";
import { runAutomations } from "@/lib/automations-engine";
import { alertStaffOfSubmission, sendTrackedEmail } from "@/lib/notify-submission";
import { sendSystemEmail } from "@/lib/send-system-email";
import { deriveEventCategory } from "@/lib/event-category";
import { BUSINESS_TIMEZONE } from "@/lib/scheduler-time";
import type { InquiryActivator, InquiryMailer, SubmissionRow } from "@/lib/security/inquiry-types";

function appOrigin() {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://www.cratesdjs.com").replace(/\/$/, "");
}

function dateLabel(isoDate: string) {
  // Date-only value: format in UTC so it never shifts a day.
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", month: "long", day: "numeric", year: "numeric" });
}

/**
 * Verification email. Fixed wording only: no name, message, venue or any
 * other submitted text goes into it, so the form can't be used to send
 * someone else arbitrary content.
 */
export const systemInquiryMailer: InquiryMailer = {
  async sendVerification(to, link, expiresHours, kind) {
    const what = kind === "consultation" ? "consultation call request" : "booking request";
    try {
      const id = await sendSystemEmail({
        to,
        subject: `Confirm your Digital Crate DJs ${what}`,
        text:
          `Please confirm your email address so we can look at your ${what}.\n\n` +
          `Confirm here:\n${link}\n\n` +
          `This link works once and expires in ${expiresHours} hours. Nothing is booked or reserved until our team confirms it with you.\n\n` +
          `If you didn't ask for this, you can ignore this email.\n\n` +
          `Digital Crate DJs\n${appOrigin()}`
      });
      return id ? "sent" : "not_configured";
    } catch {
      return "failed";
    }
  }
};

async function findOrCreateClient(sub: SubmissionRow, referral: string) {
  const db = createAdminClient();
  const { data: existing } = await db.from("clients").select("id").eq("email", sub.email).is("deleted_at", null).maybeSingle();
  if (existing?.id) return existing.id as string;
  const [firstName, ...rest] = sub.name.trim().split(" ");
  const { data, error } = await db
    .from("clients")
    .insert({ type: "individual", first_name: firstName || sub.name, last_name: rest.join(" ") || null, email: sub.email, phone: sub.phone, referral_source: referral })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

async function activateInquiry(sub: SubmissionRow): Promise<string> {
  const origin = appOrigin();
  const event = await createInquiry({
    name: sub.name,
    email: sub.email,
    phone: sub.phone ?? undefined,
    eventDate: sub.event_date!,
    eventType: sub.event_type ?? "Other",
    preferredDjId: sub.preferred_dj_id ?? undefined,
    message: sub.message ?? undefined,
    venueName: sub.venue_name ?? undefined,
    expectedGuests: sub.expected_guests ?? undefined,
    budgetRange: sub.budget_range ?? undefined
  });

  await logActivity({ actorLabel: sub.source === "wordpress" ? "Website inquiry (digitalcratedjs.com)" : "Website inquiry form", action: "lead.created", entityType: "event", entityId: event.id, eventId: event.id, metadata: { email_verified: true } });
  await runAutomations("lead_created", event.id, origin);

  try {
    let djName: string | null = null;
    if (sub.preferred_dj_id) {
      const { data: dj } = await createAdminClient().from("djs").select("display_name").eq("id", sub.preferred_dj_id).maybeSingle();
      djName = dj?.display_name ?? null;
    }
    await sendInquiryAlertSms({ name: sub.name, eventDate: sub.event_date!, eventType: sub.event_type ?? "Other", djName });
  } catch {
    // Best-effort ops alert.
  }

  await alertStaffOfSubmission({
    title: `New booking request — ${sub.name}`,
    body: `Event date: ${dateLabel(sub.event_date!)}\nEvent type: ${sub.event_type}\nEmail: ${sub.email} (confirmed)`,
    eventId: event.id,
    origin
  });

  const firstName = sub.name.trim().split(" ")[0] || sub.name;
  await sendTrackedEmail({
    to: sub.email,
    subject: "We got your booking request — set up your event portal",
    text:
      `Hi ${firstName},\n\n` +
      `Thanks for confirming your email! We've received your ${(sub.event_type ?? "event").toLowerCase()} inquiry for ${dateLabel(sub.event_date!)}` +
      ` and our team will be in touch within 24 hours to confirm details. Your date isn't reserved until we confirm it with you.\n\n` +
      `In the meantime, you can create a free account to track your event, sign your contract, manage payments, ` +
      `and build your "must play / do not play" song list — all in one place:\n\n${origin}/portal/signup\n\n` +
      `Important: sign up with this exact email address (${sub.email}) so it connects automatically to your event.\n\n` +
      `Talk soon,\nDigital Crate DJs`,
    eventId: event.id,
    failureTitle: `Confirmation email to ${sub.name} didn't send`,
    repliesToStaff: true
  });

  return event.id as string;
}

async function activateConsultation(sub: SubmissionRow): Promise<string> {
  const origin = appOrigin();
  const db = createAdminClient();
  const clientId = await findOrCreateClient(sub, "scheduler");
  const { data: event, error } = await db
    .from("events")
    .insert({
      event_code: `CONSULT-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
      title: `Consultation call — ${sub.name}`,
      client_id: clientId,
      starts_at: sub.slot_start,
      ends_at: sub.slot_end,
      status: "inquiry",
      event_status: "tentative",
      event_type: "consultation",
      event_category: deriveEventCategory("consultation"),
      special_requests: sub.message
    })
    .select()
    .single();
  if (error) throw error;

  await logActivity({ actorLabel: "Scheduler", action: "lead.created", entityType: "event", entityId: event.id, eventId: event.id, metadata: { email_verified: true } });
  await runAutomations("lead_created", event.id, origin);

  const whenLabel = new Date(sub.slot_start!).toLocaleString("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
  await alertStaffOfSubmission({
    title: `New consultation booked — ${sub.name}`,
    body: `When: ${whenLabel}\nEmail: ${sub.email} (confirmed)${sub.phone ? `\nPhone: ${sub.phone}` : ""}`,
    eventId: event.id,
    origin
  });
  const firstName = sub.name.trim().split(" ")[0] || sub.name;
  await sendTrackedEmail({
    to: sub.email,
    subject: "Your consultation call with Digital Crate DJs is booked",
    text:
      `Hi ${firstName},\n\n` +
      `Thanks for confirming your email. Your consultation call with Digital Crate DJs is scheduled for ${whenLabel}.\n\n` +
      `We'll reach out at this email address${sub.phone ? " or the phone number you gave us" : ""} around that time. ` +
      `If you need to change the time, just reply to this email and we'll sort it out.\n\n` +
      `Talk soon,\nDigital Crate DJs`,
    eventId: event.id,
    failureTitle: `Confirmation email to ${sub.name} didn't send`,
    repliesToStaff: true
  });
  return event.id as string;
}

export const leadActivator: InquiryActivator = {
  activate: (sub) => (sub.kind === "consultation" ? activateConsultation(sub) : activateInquiry(sub))
};
