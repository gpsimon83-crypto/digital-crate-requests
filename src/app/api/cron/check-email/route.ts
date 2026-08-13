import { NextRequest, NextResponse } from "next/server";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { listAllEmailAccountsWithSecret, markAccountChecked } from "@/lib/data/email-accounts";
import { recordInboundMessage } from "@/lib/data/email";
import { createEventFile } from "@/lib/data/event-files";
import { createAdminClient } from "@/lib/supabase/admin";

const FILES_BUCKET = "event-files";

/**
 * Polled on a schedule (see vercel.json) rather than pushed, since a
 * regular IMAP mailbox can't call a webhook the way Resend/Postmark can.
 * Each connected DJ mailbox is checked for unseen mail; a reply is only
 * filed into a project thread if its subject still carries the
 * "[EVENT_CODE]" tag this app puts in every outbound subject line, and
 * only if that event actually belongs to this DJ — unmatched mail is left
 * alone (still unread in the real inbox) rather than guessed at.
 */
export async function GET(req: NextRequest) {
  // Vercel Cron automatically sends this header when CRON_SECRET is set in
  // the project's environment — see https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await listAllEmailAccountsWithSecret();
  const db = createAdminClient();
  const results: { djId: string; checked: boolean; found: number; error?: string }[] = [];

  for (const account of accounts) {
    const client = new ImapFlow({
      host: account.imapHost,
      port: account.imapPort,
      secure: account.imapPort === 993,
      auth: { user: account.emailAddress, pass: account.password },
      logger: false
    });

    let found = 0;
    try {
      await client.connect();
      const lock = await client.getMailboxLock("INBOX");
      try {
        const searchResult = await client.search({ seen: false }, { uid: true });
        const uids = searchResult ? searchResult : [];
        for (const uid of uids) {
          const msg = await client.fetchOne(uid, { envelope: true, source: true }, { uid: true });
          if (!msg || !msg.source) continue;

          const parsed = await simpleParser(msg.source);
          const subject = parsed.subject ?? "";
          const match = subject.match(/\[([A-Z0-9-]+)\]\s*$/);

          if (match) {
            const eventCode = match[1];
            const { data: event } = await db
              .from("events")
              .select("id, client_id, dj_id")
              .eq("event_code", eventCode)
              .eq("dj_id", account.djId)
              .maybeSingle();

            if (event) {
              const fromAddress = parsed.from?.value?.[0]?.address ?? "unknown";
              const fromName = parsed.from?.value?.[0]?.name;
              const inboundMessage = await recordInboundMessage({
                eventId: event.id,
                clientId: event.client_id,
                fromEmail: fromAddress,
                fromName: fromName ?? undefined,
                toEmail: account.emailAddress,
                subject,
                body: parsed.text ?? "(no plain-text body)"
              });

              for (const attachment of parsed.attachments ?? []) {
                if (!attachment.content || attachment.content.length === 0) continue;
                const ext = (attachment.filename ?? "").split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
                const path = `${event.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
                const { error: uploadError } = await db.storage.from(FILES_BUCKET).upload(path, attachment.content, {
                  contentType: attachment.contentType || "application/octet-stream"
                });
                if (uploadError) continue;
                const { data: pub } = db.storage.from(FILES_BUCKET).getPublicUrl(path);
                await createEventFile(event.id, {
                  category: "email_attachment",
                  fileUrl: pub.publicUrl,
                  fileName: attachment.filename || "attachment",
                  source: "email",
                  emailMessageId: inboundMessage.id
                });
              }

              found += 1;
            }
          }

          await client.messageFlagsAdd(uid, ["\\Seen"], { uid: true });
        }
      } finally {
        lock.release();
      }
      await client.logout();
      await markAccountChecked(account.djId);
      results.push({ djId: account.djId, checked: true, found });
    } catch (err) {
      results.push({ djId: account.djId, checked: false, found, error: err instanceof Error ? err.message : "Unknown error" });
    }
  }

  return NextResponse.json({ results });
}
