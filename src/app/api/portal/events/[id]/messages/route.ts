import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getClientForAuthUser, getClientEvent } from "@/lib/data/portal";
import { listEventMessages, recordInboundMessage } from "@/lib/data/email";
import { getEmailAccountWithSecretForDj } from "@/lib/data/email-accounts";
import { sendSystemEmail } from "@/lib/send-system-email";
import { errorMessage } from "@/lib/error-message";

/**
 * Client-facing view of the same email_messages thread staff/DJs already
 * see on admin/events/[id] and dj-dashboard/projects/[id] — reusing the
 * data, not building a new chat system. A reply is sent as a real email
 * (via Resend) to the assigned DJ's connected mailbox, tagged with the
 * event code the same way the IMAP inbound cron already matches on, so
 * further replies from the DJ keep landing in this same thread.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  try {
    const client = await getClientForAuthUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record linked to this account" }, { status: 403 });
    const event = await getClientEvent(client.id, id);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

    const messages = await listEventMessages(id);
    const djEmailConnected = event.dj_id ? !!(await getEmailAccountWithSecretForDj(event.dj_id)) : false;

    return NextResponse.json({ messages, djEmailConnected, djName: event.djs?.display_name ?? null });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const text = (body.body as string | undefined)?.trim();
  if (!text) return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });

  try {
    const client = await getClientForAuthUser(user.id);
    if (!client) return NextResponse.json({ error: "No client record linked to this account" }, { status: 403 });
    const event = await getClientEvent(client.id, id);
    if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    if (!client.email) return NextResponse.json({ error: "No email address on your account." }, { status: 400 });

    if (!event.dj_id) {
      return NextResponse.json({ error: "No DJ is assigned to your event yet — reach out to us directly in the meantime." }, { status: 400 });
    }
    const account = await getEmailAccountWithSecretForDj(event.dj_id);
    if (!account) {
      return NextResponse.json(
        { error: "Your DJ hasn't set up messaging yet. Email us directly and we'll make sure it reaches them." },
        { status: 400 }
      );
    }

    const subject = `Message from ${client.first_name ?? "your client"} [${event.event_code}]`;

    try {
      await sendSystemEmail({ to: account.emailAddress, replyTo: client.email, subject, text });
    } catch (err) {
      console.error("client portal message send failed for event", id, err);
      return NextResponse.json({ error: "Failed to send your message — try again in a moment." }, { status: 503 });
    }

    const message = await recordInboundMessage({
      eventId: id,
      clientId: client.id,
      fromEmail: client.email,
      fromName: [client.first_name, client.last_name].filter(Boolean).join(" ") || client.company_name || "Client",
      toEmail: account.emailAddress,
      subject,
      body: text
    });

    return NextResponse.json({ message });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
