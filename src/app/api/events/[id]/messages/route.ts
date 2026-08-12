import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { listEventMessages, recordOutboundMessage } from "@/lib/data/email";
import { getEmailAccountWithSecretForDj } from "@/lib/data/email-accounts";
import { sendEmailFromAccount } from "@/lib/send-email";
import { errorMessage } from "@/lib/error-message";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const messages = await listEventMessages(id);
    return NextResponse.json({ messages });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  const { body, subject: subjectInput } = (await req.json()) as { body?: string; subject?: string };
  if (!body?.trim()) return NextResponse.json({ error: "Message can't be empty." }, { status: 400 });

  const clientRow = Array.isArray(access.event.clients) ? access.event.clients[0] : access.event.clients;
  const clientEmail = clientRow?.email;
  if (!clientEmail) return NextResponse.json({ error: "This project has no client email on file." }, { status: 400 });

  if (!access.dj) {
    return NextResponse.json({ error: "Only a DJ with their own connected mailbox can send from here right now." }, { status: 400 });
  }

  const account = await getEmailAccountWithSecretForDj(access.dj.id);
  if (!account) {
    return NextResponse.json({ error: "Connect your email account in your profile before sending." }, { status: 400 });
  }

  const tag = `[${access.event.event_code}]`;
  const baseSubject = subjectInput?.trim() || access.event.title;
  const subject = baseSubject.includes(tag) ? baseSubject : `${baseSubject} ${tag}`;

  try {
    const messageId = await sendEmailFromAccount(account, {
      to: clientEmail,
      subject,
      text: body,
      fromName: access.dj.display_name
    });

    const message = await recordOutboundMessage({
      eventId: id,
      clientId: access.event.client_id,
      fromEmail: account.emailAddress,
      fromName: access.dj.display_name,
      toEmail: clientEmail,
      subject,
      body,
      resendMessageId: messageId,
      sentByUserId: access.user.id
    });

    return NextResponse.json({ message });
  } catch (err) {
    return NextResponse.json({ error: `Failed to send — ${errorMessage(err)}` }, { status: 502 });
  }
}
