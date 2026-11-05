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

/**
 * Adds starter designs for any audience that has none yet (so new starter
 * sets, like the DJ team templates, appear without touching designs the
 * admin already has). A deleted starter isn't brought back.
 */
export async function ensureStarterDesigns() {
  const db = createAdminClient();
  const { data, error } = await db.from("comm_email_designs").select("id, name, audience, is_starter, subject, preheader, blocks, created_at, updated_at");
  if (error) throw error;
  await refreshUneditedStarters(data ?? []);
  const seeded = new Set((data ?? []).filter((r) => r.is_starter).map((r) => r.audience));
  const isEmpty = (data ?? []).length === 0;
  // Client starters only go into an empty library; other audiences are added once.
  const toAdd = STARTER_DESIGNS.filter((d) => (d.audience === "client" ? isEmpty : !seeded.has(d.audience)));
  if (!toAdd.length) return;
  const { error: insErr } = await db.from("comm_email_designs").insert(
    toAdd.map((d) => ({ name: d.name, audience: d.audience, subject: d.subject, preheader: d.preheader, theme: d.theme, blocks: d.blocks, is_starter: true }))
  );
  if (insErr) throw insErr;
}

/**
 * When a starter's built-in content improves, copies that have never been
 * edited (updated_at still equals created_at) pick up the new version.
 * Anything an admin has changed is left alone.
 */
async function refreshUneditedStarters(
  rows: { id: string; name: string; audience: string; is_starter: boolean; subject: string; preheader: string; blocks: unknown; created_at: string; updated_at: string }[]
) {
  const db = createAdminClient();
  for (const row of rows) {
    if (!row.is_starter || new Date(row.updated_at).getTime() - new Date(row.created_at).getTime() > 1000) continue;
    const latest = STARTER_DESIGNS.find((d) => d.name === row.name && d.audience === row.audience);
    if (!latest) continue;
    if (stableJson(stripIds(row.blocks)) === stableJson(stripIds(latest.blocks)) && row.subject === latest.subject && row.preheader === latest.preheader) continue;
    await db
      .from("comm_email_designs")
      .update({ subject: latest.subject, preheader: latest.preheader, blocks: latest.blocks, updated_at: row.created_at })
      .eq("id", row.id)
      .eq("updated_at", row.updated_at);
  }
}

function stripIds(blocks: unknown) {
  return Array.isArray(blocks)
    ? blocks.map((b) => {
        const { id: _id, ...rest } = b as Record<string, unknown>;
        void _id;
        return rest;
      })
    : [];
}

/** JSON with sorted keys (Postgres jsonb doesn't keep key order). */
function stableJson(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stableJson).join(",")}]`;
  if (v && typeof v === "object") {
    return `{${Object.keys(v as object)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableJson((v as Record<string, unknown>)[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v ?? null);
}

export const MEMBERS_LINK = "https://digitalcratedjs.com/members/";

/**
 * DJ team recipients. Email comes from the DJ's CRM login (auth user), or
 * their email-signature address if they have no login. Event fields come
 * from the DJ's next assigned upcoming event, if any.
 */
export async function recipientsForDjs(djIds: string[]): Promise<Recipient[]> {
  if (!djIds.length) return [];
  const db = createAdminClient();
  const { data: djs, error } = await db.from("djs").select("id, display_name, auth_user_id, signature_email").in("id", djIds);
  if (error) throw error;
  const emails = await authEmailsById();
  const { data: events } = await db
    .from("events")
    .select("id, dj_id, event_type, starts_at, venues(name)")
    .in("dj_id", djIds)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  return (djs ?? [])
    .map((d) => {
      const email = (d.auth_user_id && emails.get(d.auth_user_id)) || d.signature_email || "";
      const next = (events ?? []).find((e) => e.dj_id === d.id);
      const venue = next ? (next.venues as unknown as { name?: string } | null)?.name : undefined;
      const values: MergeValues = {
        dj_name: d.display_name || "",
        first_name: d.display_name || "",
        full_name: d.display_name || "",
        company_name: COMPANY_NAME,
        members_link: MEMBERS_LINK,
        event_type: next?.event_type || "",
        event_date: next?.starts_at ? fmtDate(next.starts_at) : "",
        event_time: next?.starts_at ? fmtTime(next.starts_at) : "",
        venue_name: venue || ""
      };
      return { email: email.trim(), name: d.display_name || null, clientId: null, eventId: next?.id ?? null, values };
    })
    .filter((r) => isValidEmail(r.email));
}

async function authEmailsById(): Promise<Map<string, string>> {
  const db = createAdminClient();
  const out = new Map<string, string>();
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) break;
    for (const u of data.users) if (u.email) out.set(u.id, u.email);
    if (data.users.length < 200) break;
  }
  return out;
}

/** DJ picker list for the Studio (only DJs with a usable email). */
export async function djRecipientOptions(q: string) {
  const db = createAdminClient();
  const { data, error } = await db.from("djs").select("id, display_name, auth_user_id, signature_email").order("display_name");
  if (error) throw error;
  const emails = await authEmailsById();
  const needle = q.trim().toLowerCase();
  return (data ?? [])
    .map((d) => ({ id: d.id as string, name: (d.display_name as string) || "DJ", email: ((d.auth_user_id && emails.get(d.auth_user_id)) || d.signature_email || "") as string, nextEvent: null }))
    .filter((d) => isValidEmail(d.email) && (!needle || d.name.toLowerCase().includes(needle) || d.email.toLowerCase().includes(needle)));
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
    .map((email) => ({ email, name: null, clientId: null, eventId: null, values: { company_name: COMPANY_NAME, portal_link: `${appOrigin()}/portal`, members_link: MEMBERS_LINK } }));
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
