import { sendSystemEmail } from "@/lib/send-system-email";
import { zonedTimeToUtc, BUSINESS_TIMEZONE } from "@/lib/scheduler-time";
import type { MeetingInput } from "@/lib/data/event-meetings";

/**
 * Staff enter a business-local date + time + duration; we store UTC.
 * Returns an error string instead of throwing so routes can 400 cleanly.
 */
export function parseMeetingBody(body: Record<string, unknown>): { input: MeetingInput } | { error: string } {
  const { date, time, durationMinutes, location, meetingUrl, notes } = body as {
    date?: string;
    time?: string;
    durationMinutes?: number;
    location?: string;
    meetingUrl?: string;
    notes?: string;
  };

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "A valid date is required" };
  if (!time || !/^\d{2}:\d{2}$/.test(time)) return { error: "A valid time is required" };
  const duration = Number(durationMinutes ?? 30);
  if (!Number.isFinite(duration) || duration < 15 || duration > 480) return { error: "Duration must be between 15 and 480 minutes" };

  const url = meetingUrl?.trim();
  if (url && !/^https?:\/\//i.test(url)) return { error: "Meeting link must start with http:// or https://" };

  const start = zonedTimeToUtc(date, time);
  if (Number.isNaN(start.getTime())) return { error: "That date and time isn't valid" };
  const end = new Date(start.getTime() + duration * 60000);

  return {
    input: {
      startsAt: start.toISOString(),
      endsAt: end.toISOString(),
      location: location?.trim() || null,
      meetingUrl: url || null,
      notes: notes?.trim() || null
    }
  };
}

export function formatMeetingWhen(startsAt: string): string {
  return new Date(startsAt).toLocaleString("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short"
  });
}

type ClientJoin = { email: string | null; first_name: string | null } | { email: string | null; first_name: string | null }[] | null;

/** Best-effort — a failed email never fails the scheduling action itself. */
export async function emailClientAboutMeeting(input: {
  kind: "scheduled" | "rescheduled" | "cancelled";
  client: ClientJoin;
  eventTitle: string | null;
  meeting: { starts_at: string; location: string | null; meeting_url: string | null; notes: string | null };
  eventId: string;
}) {
  try {
    const client = Array.isArray(input.client) ? input.client[0] : input.client;
    if (!client?.email) return;

    const firstName = client.first_name?.trim() || "there";
    const when = formatMeetingWhen(input.meeting.starts_at);
    const details =
      (input.meeting.location ? `Where: ${input.meeting.location}\n` : "") +
      (input.meeting.meeting_url ? `Join link: ${input.meeting.meeting_url}\n` : "") +
      (input.meeting.notes ? `Notes: ${input.meeting.notes}\n` : "");

    const subject =
      input.kind === "cancelled"
        ? "Your meeting with Digital Crate DJs was cancelled"
        : input.kind === "rescheduled"
          ? "Your meeting with Digital Crate DJs was rescheduled"
          : "Your meeting with Digital Crate DJs is scheduled";

    const lead =
      input.kind === "cancelled"
        ? `Your meeting${input.eventTitle ? ` about ${input.eventTitle}` : ""} that was set for ${when} has been cancelled. We'll be in touch to find a new time.`
        : `${input.kind === "rescheduled" ? "Your meeting has been moved. " : ""}You're scheduled to meet with Digital Crate DJs${input.eventTitle ? ` about ${input.eventTitle}` : ""}.\n\nWhen: ${when}`;

    const text =
      `Hi ${firstName},\n\n${lead}\n` +
      (input.kind === "cancelled" ? "" : `${details ? `${details}` : ""}\nYou can also see this in your event portal.\n`) +
      `\nTalk soon,\nDigital Crate DJs`;

    await sendSystemEmail({ to: client.email, subject, text });
  } catch (err) {
    console.error("meeting email failed for event", input.eventId, err);
  }
}
