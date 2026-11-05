import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";

/**
 * Resend delivery events for Communications Center emails. Resend signs
 * webhooks with Svix; requests without a valid signature are rejected,
 * and nothing is accepted at all until RESEND_WEBHOOK_SECRET is set.
 *
 * Updates comm_email_recipients by Resend message ID. Bounces and spam
 * complaints add the address to comm_email_suppressions so it's skipped
 * on future sends. Emails sent by other parts of the CRM have no
 * matching row here and are simply ignored.
 */

const RANK: Record<string, number> = { queued: 0, sent: 1, delayed: 2, delivered: 3 };
const TERMINAL = new Set(["bounced", "complained", "failed", "suppressed"]);

function verify(req: NextRequest, body: string, secret: string): boolean {
  const id = req.headers.get("svix-id");
  const ts = req.headers.get("svix-timestamp");
  const sigHeader = req.headers.get("svix-signature");
  if (!id || !ts || !sigHeader) return false;
  if (Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key).update(`${id}.${ts}.${body}`).digest();
  return sigHeader.split(" ").some((part) => {
    const [version, sig] = part.split(",");
    if (version !== "v1" || !sig) return false;
    const got = Buffer.from(sig, "base64");
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

export async function POST(req: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  const body = await req.text();
  if (!verify(req, body, secret)) return NextResponse.json({ error: "Invalid signature" }, { status: 401 });

  let evt: { type?: string; created_at?: string; data?: { email_id?: string; to?: string[]; bounce?: { message?: string } } };
  try {
    evt = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }
  const messageId = evt.data?.email_id;
  if (!messageId || !evt.type) return NextResponse.json({ ok: true });

  try {
    const db = createAdminClient();
    const { data: rows } = await db.from("comm_email_recipients").select("id, email, status").eq("resend_message_id", messageId);
    if (!rows?.length) return NextResponse.json({ ok: true });
    const now = new Date().toISOString();

    for (const row of rows) {
      const update: Record<string, string | null> = { updated_at: now };
      switch (evt.type) {
        case "email.sent":
        case "email.delivered":
        case "email.delivery_delayed": {
          const next = evt.type === "email.sent" ? "sent" : evt.type === "email.delivered" ? "delivered" : "delayed";
          if (!TERMINAL.has(row.status) && (RANK[next] ?? 0) > (RANK[row.status] ?? 0)) update.status = next;
          break;
        }
        case "email.bounced":
          update.status = "bounced";
          update.error = evt.data?.bounce?.message?.slice(0, 500) ?? "Bounced";
          await db.from("comm_email_suppressions").upsert({ email: row.email.toLowerCase(), reason: "bounce", detail: update.error });
          break;
        case "email.complained":
          update.status = "complained";
          await db.from("comm_email_suppressions").upsert({ email: row.email.toLowerCase(), reason: "complaint", detail: "Marked as spam" });
          break;
        case "email.failed":
          update.status = "failed";
          break;
        case "email.suppressed":
          update.status = "suppressed";
          break;
        case "email.opened":
          update.opened_at = now;
          break;
        case "email.clicked":
          update.clicked_at = now;
          break;
        default:
          continue;
      }
      await db.from("comm_email_recipients").update(update).eq("id", row.id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
