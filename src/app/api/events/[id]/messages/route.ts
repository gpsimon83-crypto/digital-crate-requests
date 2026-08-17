import { NextRequest, NextResponse } from "next/server";
import { requireEventAccess } from "@/lib/require-event-access";
import { listEventMessages, recordOutboundMessage } from "@/lib/data/email";
import { getEmailAccountWithSecretForDj } from "@/lib/data/email-accounts";
import { sendEmailFromAccount } from "@/lib/send-email";
import { buildEmailSignature } from "@/lib/email-signature";
import { createEventFile } from "@/lib/data/event-files";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

const BUCKET = "event-files";

async function uploadAttachment(eventId: string, file: File) {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `${eventId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const db = createAdminClient();
  const { error: uploadError } = await db.storage.from(BUCKET).upload(path, buffer, { contentType: file.type || "application/octet-stream" });
  if (uploadError) throw uploadError;

  const { data: pub } = db.storage.from(BUCKET).getPublicUrl(path);
  return { buffer, publicUrl: pub.publicUrl, filename: file.name, contentType: file.type || undefined };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  try {
    const messages = await listEventMessages(id);
    const signature = access.dj ? buildEmailSignature(access.dj) : null;
    return NextResponse.json({ messages, signature });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const access = await requireEventAccess(id);
  if (!access.authorized) return NextResponse.json({ error: access.error }, { status: access.status });

  const contentType = req.headers.get("content-type") ?? "";
  let body: string | undefined;
  let subjectInput: string | undefined;
  let attachmentFiles: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    body = String(form.get("body") ?? "");
    subjectInput = form.get("subject") ? String(form.get("subject")) : undefined;
    attachmentFiles = form.getAll("attachments").filter((f): f is File => f instanceof File && f.size > 0);
  } else {
    const json = (await req.json()) as { body?: string; subject?: string };
    body = json.body;
    subjectInput = json.subject;
  }

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
  const fullBody = `${body}\n\n${buildEmailSignature(access.dj)}`;

  try {
    const uploaded = await Promise.all(attachmentFiles.map((f) => uploadAttachment(id, f)));

    const messageId = await sendEmailFromAccount(account, {
      to: clientEmail,
      subject,
      text: fullBody,
      fromName: access.dj.display_name,
      attachments: uploaded.map((u) => ({ filename: u.filename, content: u.buffer, contentType: u.contentType }))
    });

    const message = await recordOutboundMessage({
      eventId: id,
      clientId: access.event.client_id,
      fromEmail: account.emailAddress,
      fromName: access.dj.display_name,
      toEmail: clientEmail,
      subject,
      body: fullBody,
      resendMessageId: messageId,
      sentByUserId: access.user.id
    });

    await Promise.all(
      uploaded.map((u) =>
        createEventFile(id, {
          category: "email_attachment",
          fileUrl: u.publicUrl,
          fileName: u.filename,
          source: "email",
          emailMessageId: message.id,
          uploadedBy: access.user.id
        })
      )
    );

    return NextResponse.json({ message });
  } catch (err) {
    return NextResponse.json({ error: `Failed to send — ${errorMessage(err)}` }, { status: 502 });
  }
}
