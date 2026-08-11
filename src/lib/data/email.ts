import { createAdminClient } from "@/lib/supabase/admin";

export interface EmailMessage {
  id: string;
  event_id: string;
  client_id: string | null;
  direction: "outbound" | "inbound";
  from_email: string;
  from_name: string | null;
  to_email: string;
  subject: string | null;
  body: string;
  resend_message_id: string | null;
  sent_by_user_id: string | null;
  seen_at: string | null;
  created_at: string;
}

export async function listEventMessages(eventId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("email_messages")
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as EmailMessage[];
}

export async function recordOutboundMessage(input: {
  eventId: string;
  clientId?: string | null;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject?: string;
  body: string;
  resendMessageId?: string;
  sentByUserId: string;
}) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("email_messages")
    .insert({
      event_id: input.eventId,
      client_id: input.clientId ?? null,
      direction: "outbound",
      from_email: input.fromEmail,
      from_name: input.fromName ?? null,
      to_email: input.toEmail,
      subject: input.subject ?? null,
      body: input.body,
      resend_message_id: input.resendMessageId ?? null,
      sent_by_user_id: input.sentByUserId
    })
    .select()
    .single();
  if (error) throw error;
  return data as EmailMessage;
}

export async function recordInboundMessage(input: {
  eventId: string;
  clientId?: string | null;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject?: string;
  body: string;
  resendMessageId?: string;
}) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("email_messages")
    .insert({
      event_id: input.eventId,
      client_id: input.clientId ?? null,
      direction: "inbound",
      from_email: input.fromEmail,
      from_name: input.fromName ?? null,
      to_email: input.toEmail,
      subject: input.subject ?? null,
      body: input.body,
      resend_message_id: input.resendMessageId ?? null
    })
    .select()
    .single();
  if (error) throw error;
  return data as EmailMessage;
}

export async function markMessageSeen(id: string) {
  const db = createAdminClient();
  const { error } = await db
    .from("email_messages")
    .update({ seen_at: new Date().toISOString() })
    .eq("id", id)
    .is("seen_at", null);
  if (error) throw error;
}

/**
 * Finds the event a reply-to token maps to. Each event's event_code is
 * reused as the local part of a dedicated reply address, e.g.
 * CASEY-0704@reply.cratesdjs.com, so inbound webhooks can route a reply
 * back to the right project without a separate thread-key column.
 */
export async function findEventByReplyToken(eventCode: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .select("id, client_id, dj_id, title, clients(email)")
    .eq("event_code", eventCode)
    .maybeSingle();
  if (error) throw error;
  return data;
}
