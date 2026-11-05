// Communications Center — server-only helpers: who's signed in, recipient
// merge data from CRM records, and sending through Resend.

import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffRole } from "@/lib/roles";
import { COMPANY_NAME } from "@/lib/merge-fields";
import { missingTokens, sanitizeDesign, type EmailDesign, type MergeValues } from "./blocks";
import { renderEmailHtml, renderEmailText } from "./render";
import { STARTER_DESIGNS } from "./starters";

export const BUSINESS_TZ = "America/Chicago";
export const MAX_RECIPIENTS_PER_SEND = 500;

/** Staff-only gate that also returns the user (for created_by / sent_by). */
export async function requireStaffUser(): Promise<{ userId: string; email: string | null } | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user || !isStaffRole(user.user_metadata?.role)) {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  return { userId: user.id, email: user.email ?? null };
}

export function appOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || "https://cratesdjs.com").replace(/\/$/, "");
}

/** What the Settings tab shows; never returns secret values. */
export function providerStatus() {
  // Communications Center emails can use their own sender (e.g. crateservices@)
  // without changing the CRM's other system emails.
  const from = process.env.COMM_EMAIL_FROM || process.env.SYSTEM_EMAIL_FROM || "";
  return {
    configured: !!(process.env.RESEND_API_KEY && from),
    from,
    replyTo: replyToAddress(),
    webhookConfigured: !!process.env.RESEND_WEBHOOK_SECRET
  };
}

function replyToAddress(): string {
  return (process.env.COMM_REPLY_TO || (process.env.OPS_ALERT_EMAILS || "").split(",")[0] || "").trim();
}

/** Inserts the starter designs the first time the Communications Center is opened. */
export async function ensureStarterDesigns() {
  const db = createAdminClient();
  const { count, error } = await db.from("comm_email_designs").select("id", { count: "exact", head: true });
  if (error) throw error;
  if ((count ?? 0) > 0) return;
  await db.from("comm_email_designs").insert(
    STARTER_DESIGNS.map((d) => ({ name: d.name, audience: d.audience, subject: d.subject, preheader: d.preheader, theme: d.theme, blocks: d.blocks, is_starter: true }))
  );
}

export interface Recipient {
  email: string;
  name: string | null;
  clientId: string | null;
  eventId: string | null;
  values: MergeValues;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { timeZone: BUSINESS_TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("en-US", { timeZone: BUSINESS_TZ, hour: "numeric", minute: "2-digit" });
}

const EMAIL_RE = /^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/;
export function isValidEmail(e: string) {
  return EMAIL_RE.test(e.trim());
}

async function reviewLink(): Promise<string> {
  const db = createAdminClient();
  const { data } = await db.from("platform_settings").select("review_url").eq("id", true).maybeSingle();
  return (data?.review_url as string | null) ?? "";
}

/**
 * Builds each client's merge values from their own records only. The
 * event used is the one picked in the Studio (when it belongs to that
 * client), otherwise the client's next upcoming event, otherwise their
 * most recent one.
 */
export async function recipientsForClients(clientIds: string[], eventId?: string | null): Promise<Recipient[]> {
  if (!clientIds.length) return [];
  const db = createAdminClient();
  const origin = appOrigin();
  const review = await reviewLink();
  const { data: clients, error } = await db.from("clients").select("id, first_name, last_name, company_name, email").in("id", clientIds);
  if (error) throw error;
  const { data: events, error: evErr } = await db
    .from("events")
    .select("id, client_id, event_type, starts_at, venues(name), djs(display_name)")
    .in("client_id", clientIds)
    .order("starts_at", { ascending: true });
  if (evErr) throw evErr;

  const now = Date.now();
  return (clients ?? [])
    .filter((c) => c.email && isValidEmail(c.email))
    .map((c) => {
      const theirs = (events ?? []).filter((e) => e.client_id === c.id);
      const picked =
        (eventId && theirs.find((e) => e.id === eventId)) ||
        theirs.find((e) => e.starts_at && new Date(e.starts_at).getTime() >= now) ||
        theirs[theirs.length - 1] ||
        null;
      const full = [c.first_name, c.last_name].filter(Boolean).join(" ") || c.company_name || "";
      const venue = picked ? (picked.venues as unknown as { name?: string } | null)?.name : undefined;
      const dj = picked ? (picked.djs as unknown as { display_name?: string } | null)?.display_name : undefined;
      const values: MergeValues = {
        first_name: c.first_name || c.company_name || "",
        last_name: c.last_name || "",
        full_name: full,
        company_name: COMPANY_NAME,
        event_type: picked?.event_type || "",
        event_date: picked?.starts_at ? fmtDate(picked.starts_at) : "",
        event_time: picked?.starts_at ? fmtTime(picked.starts_at) : "",
        venue_name: venue || "",
        dj_name: dj || "",
        portal_link: picked ? `${origin}/portal/events/${picked.id}` : `${origin}/portal`,
        review_link: review
      };
      return { email: c.email!.trim(), name: full || null, clientId: c.id, eventId: picked?.id ?? null, values };
    });
}

/** Typed-in addresses (not CRM clients) only get the company name filled in. */
export function recipientsForAddresses(emails: string[]): Recipient[] {
  return emails
    .map((e) => e.trim())
    .filter(isValidEmail)
    .map((email) => ({ email, name: null, clientId: null, eventId: null, values: { company_name: COMPANY_NAME, portal_link: `${appOrigin()}/portal` } }));
}

export interface SendResult {
  sendId: string;
  sent: number;
  suppressed: number;
  failed: number;
  errors: string[];
}

/**
 * Sends one personalized copy per recipient (never one email with
 * everyone on it), through Resend's batch API in chunks of 100. Every
 * recipient gets a row in comm_email_recipients with its real status;
 * suppressed addresses are recorded and skipped.
 */
export async function sendDesign(opts: {
  designId: string | null;
  design: EmailDesign;
  recipients: Recipient[];
  isTest: boolean;
  userId: string;
}): Promise<SendResult> {
  const status = providerStatus();
  if (!status.configured) throw new Error("Email sending isn't set up yet: RESEND_API_KEY and COMM_EMAIL_FROM (or SYSTEM_EMAIL_FROM) must be configured.");
  const design = sanitizeDesign(opts.design);
  if (!design.subject.trim()) throw new Error("Add a subject line before sending.");

  // De-duplicate by address (case-insensitive), keep first.
  const seen = new Set<string>();
  const recipients = opts.recipients.filter((r) => {
    const k = r.email.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  if (!recipients.length) throw new Error("No valid recipients.");
  if (recipients.length > MAX_RECIPIENTS_PER_SEND) throw new Error(`Send to ${MAX_RECIPIENTS_PER_SEND} people or fewer at a time.`);

  const db = createAdminClient();
  const { data: suppressedRows } = await db
    .from("comm_email_suppressions")
    .select("email")
    .in("email", recipients.map((r) => r.email.toLowerCase()));
  const suppressed = new Set((suppressedRows ?? []).map((r) => r.email));

  const { data: sendRow, error: sendErr } = await db
    .from("comm_email_sends")
    .insert({
      design_id: opts.designId,
      design_name: design.name,
      subject: design.subject,
      design_snapshot: design,
      is_test: opts.isTest,
      recipient_count: recipients.length,
      sent_by: opts.userId
    })
    .select("id")
    .single();
  if (sendErr) throw sendErr;
  const sendId = sendRow.id as string;

  const rows = recipients.map((r) => ({
    send_id: sendId,
    client_id: r.clientId,
    event_id: r.eventId,
    email: r.email,
    name: r.name,
    status: suppressed.has(r.email.toLowerCase()) ? "suppressed" : "queued",
    error: suppressed.has(r.email.toLowerCase()) ? "Address is on the do-not-email list (bounced, complained or opted out)." : null
  }));
  const { data: inserted, error: recErr } = await db.from("comm_email_recipients").insert(rows).select("id, email, status");
  if (recErr) throw recErr;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const fromName = process.env.COMM_FROM_NAME || COMPANY_NAME;
  const rawFrom = status.from;
  const from = /</.test(rawFrom) ? rawFrom : `${fromName} <${rawFrom}>`;
  const baseUrl = appOrigin();
  const subjectPrefix = opts.isTest ? "[TEST] " : "";

  const idByEmail = new Map((inserted ?? []).map((row) => [String(row.email).toLowerCase(), row.id as string]));
  const toSend = recipients
    .map((r, i) => ({ r, rowId: idByEmail.get(r.email.toLowerCase()) as string, status: rows[i].status }))
    .filter((x) => x.status === "queued" && x.rowId);

  const result: SendResult = { sendId, sent: 0, suppressed: rows.length - toSend.length, failed: 0, errors: [] };

  for (let i = 0; i < toSend.length; i += 100) {
    const chunk = toSend.slice(i, i + 100);
    const payload = chunk.map(({ r }) => {
      const subject = subjectPrefix + design.subject.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, t: string) => r.values[t] ?? "");
      return {
        from,
        to: [r.name ? `${r.name.replace(/[<>"]/g, "")} <${r.email}>` : r.email],
        subject,
        html: renderEmailHtml(design, r.values, { baseUrl }),
        text: renderEmailText(design, r.values),
        ...(status.replyTo ? { replyTo: status.replyTo } : {}),
        tags: [{ name: "comm_send", value: sendId.replace(/[^a-zA-Z0-9_-]/g, "") }]
      };
    });
    try {
      const { data, error } = await resend.batch.send(payload, { idempotencyKey: `comm-${sendId}-${i}` });
      if (error) throw new Error(error.message);
      const ids = data?.data ?? [];
      await Promise.all(
        chunk.map(({ rowId }, j) =>
          db
            .from("comm_email_recipients")
            .update({ status: ids[j]?.id ? "sent" : "failed", resend_message_id: ids[j]?.id ?? null, error: ids[j]?.id ? null : "No message ID returned", updated_at: new Date().toISOString() })
            .eq("id", rowId)
        )
      );
      result.sent += ids.filter((x) => x?.id).length;
      result.failed += chunk.length - ids.filter((x) => x?.id).length;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      result.failed += chunk.length;
      result.errors.push(msg);
      await db
        .from("comm_email_recipients")
        .update({ status: "failed", error: msg.slice(0, 500), updated_at: new Date().toISOString() })
        .in("id", chunk.map((c) => c.rowId));
    }
  }
  return result;
}

/** For the Studio's pre-send check: recipients missing data the design uses. */
export function recipientWarnings(design: EmailDesign, recipients: Recipient[]) {
  return recipients
    .map((r) => ({ email: r.email, name: r.name, missing: missingTokens(design, r.values) }))
    .filter((w) => w.missing.length);
}
