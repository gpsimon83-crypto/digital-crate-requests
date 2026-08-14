import { createAdminClient } from "@/lib/supabase/admin";
import {
  listActiveAutomationsForTrigger,
  listActiveDateBasedAutomations,
  hasAutomationRunForEvent,
  recordAutomationRun,
  type AutomationCondition,
  type AutomationAction,
  type AutomationRow
} from "@/lib/data/automations";
import { createTask } from "@/lib/data/tasks";
import { getLibraryItem } from "@/lib/data/library";
import { getEmailAccountWithSecretForDj } from "@/lib/data/email-accounts";
import { sendEmailFromAccount } from "@/lib/send-email";
import { fillMergeFields, type MergeContext } from "@/lib/merge-fields";
import { STAFF_ROLES } from "@/lib/roles";
import { TRIGGERS, parseDateTrigger } from "@/lib/automation-capabilities";

export { TRIGGERS };

const EVENT_SELECT =
  "id, event_code, title, event_type, service_type, status, event_status, starts_at, ends_at, created_at, contract_status, quoted_amount, final_amount, dj_id, djs(display_name), venues(name), clients(first_name, last_name, company_name, email)";

interface EventContext {
  id: string;
  event_code: string;
  title: string | null;
  event_type: string | null;
  service_type: string | null;
  status: string;
  event_status: string;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  contract_status: "none" | "draft" | "sent" | "signed" | "void";
  quoted_amount: number | null;
  final_amount: number | null;
  dj_id: string | null;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
  clients: { first_name: string | null; last_name: string | null; company_name: string | null; email: string | null } | null;
  hasDepositPayment: boolean;
  balancePaid: boolean;
}

async function loadEventContext(eventId: string): Promise<EventContext | null> {
  const db = createAdminClient();
  const { data: event, error } = await db.from("events").select(EVENT_SELECT).eq("id", eventId).single();
  if (error || !event) return null;

  const { data: deposit } = await db.from("payments").select("id").eq("event_id", eventId).eq("kind", "deposit").eq("status", "succeeded").limit(1).maybeSingle();
  const { data: payments } = await db.from("payments").select("amount_cents").eq("event_id", eventId).eq("status", "succeeded");

  const raw = event as unknown as Omit<EventContext, "hasDepositPayment" | "balancePaid">;
  const totalDue = Math.round((raw.final_amount ?? raw.quoted_amount ?? 0) * 100);
  const totalPaid = (payments ?? []).reduce((sum, p) => sum + p.amount_cents, 0);
  const balancePaid = totalDue <= 0 || totalPaid >= totalDue;

  return { ...raw, hasDepositPayment: !!deposit, balancePaid };
}

function conditionField(event: EventContext, field: string, extra: Record<string, string>): string {
  switch (field) {
    case "event_type":
      return event.event_type ?? "";
    case "service_type":
      return event.service_type ?? "";
    case "status":
      return event.status;
    case "event_status":
      return event.event_status;
    case "contract_signed":
      return event.contract_status === "signed" ? "yes" : "no";
    case "deposit_paid":
      return event.hasDepositPayment ? "yes" : "no";
    case "balance_paid":
      return event.balancePaid ? "yes" : "no";
    case "payment_kind":
      return extra.payment_kind ?? "";
    default:
      return "";
  }
}

function conditionsMatch(event: EventContext, conditions: AutomationCondition[], extra: Record<string, string>): boolean {
  return conditions.every((c) => {
    const actual = conditionField(event, c.field, extra).toLowerCase();
    const expected = c.value.toLowerCase();
    return c.operator === "equals" ? actual === expected : actual !== expected;
  });
}

function buildMergeContext(event: EventContext, origin: string): MergeContext {
  const client = event.clients;
  const clientName = client ? client.company_name || [client.first_name, client.last_name].filter(Boolean).join(" ") : undefined;
  return {
    clientFirstName: client?.first_name ?? clientName,
    clientFullName: clientName,
    eventType: event.event_type ?? undefined,
    eventDate: event.starts_at ? new Date(event.starts_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : undefined,
    eventTime: event.starts_at ? new Date(event.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : undefined,
    eventEndTime: event.ends_at ? new Date(event.ends_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : undefined,
    venueName: event.venues?.name ?? undefined,
    djName: event.djs?.display_name ?? undefined,
    portalLink: `${origin}/portal/events/${event.id}`,
    eventCode: event.event_code
  };
}

async function runAction(action: AutomationAction, event: EventContext, origin: string): Promise<string> {
  switch (action.type) {
    case "create_task": {
      const dueDate = action.dueInDays != null ? new Date(Date.now() + action.dueInDays * 86400000).toISOString().slice(0, 10) : null;
      await createTask(event.id, { title: action.title, dueDate });
      return `Created task "${action.title}"`;
    }
    case "notify_staff": {
      const db = createAdminClient();
      const { data } = await db.auth.admin.listUsers();
      const staffIds = (data?.users ?? []).filter((u) => STAFF_ROLES.includes(u.user_metadata?.role)).map((u) => u.id);
      if (staffIds.length === 0) return "No staff users to notify";
      await db.from("notifications").insert(
        staffIds.map((userId) => ({
          user_id: userId,
          type: "automation",
          title: action.title,
          body: action.body ?? null,
          entity_type: "event",
          entity_id: event.id,
          event_id: event.id
        }))
      );
      return `Notified ${staffIds.length} staff member${staffIds.length === 1 ? "" : "s"}`;
    }
    case "send_email": {
      if (!event.dj_id) return "Skipped — no DJ assigned to send from";
      const account = await getEmailAccountWithSecretForDj(event.dj_id);
      if (!account) return "Skipped — assigned DJ has no connected mailbox";
      const clientEmail = event.clients?.email;
      if (!clientEmail) return "Skipped — no client email on file";
      const template = await getLibraryItem(action.templateId);
      if (!template || !template.body) return "Skipped — email template not found";

      const ctx = buildMergeContext(event, origin);
      const subject = fillMergeFields(template.subject || event.title || "Update from Digital Crate DJs", ctx);
      const body = fillMergeFields(template.body, ctx);

      await sendEmailFromAccount(account, { to: clientEmail, subject, text: body, fromName: event.djs?.display_name });
      return `Sent "${template.title}" to ${clientEmail}`;
    }
    case "unlock_music_plan": {
      if (event.event_type?.toLowerCase() !== "wedding") return "Skipped — not a wedding";
      const db = createAdminClient();
      await db.from("events").update({ wedding_music_plan_sent_at: new Date().toISOString() }).eq("id", event.id);
      return "Unlocked Wedding Music Plan in client portal";
    }
    default:
      return "Unknown action type";
  }
}

/**
 * Fires every active automation registered for `trigger`. Best-effort and
 * non-blocking for the caller — one automation erroring never stops
 * another, and this never throws back into the action that triggered it
 * (mirrors the soft-no-op pattern used for SMS/activity logging elsewhere
 * in this codebase).
 *
 * `extra` carries per-firing context that isn't a column on `events` —
 * today just the payment's own `kind`, since "was this payment the
 * deposit" only exists at the moment the payment_received trigger fires.
 */
export async function runAutomations(
  trigger: (typeof TRIGGERS)[number]["value"],
  eventId: string,
  origin: string,
  extra: Record<string, string> = {}
): Promise<void> {
  try {
    const automations = await listActiveAutomationsForTrigger(trigger);
    if (automations.length === 0) return;

    const ctx = await loadEventContext(eventId);
    if (!ctx) return;

    for (const automation of automations as AutomationRow[]) {
      await runOne(automation, ctx, origin, extra);
    }
  } catch {
    // best-effort — automations never block the flow that triggered them
  }
}

function daysBetween(from: Date, to: Date): number {
  const ms = to.getTime() - from.getTime();
  return Math.round(ms / 86400000);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Checked once daily (see /api/cron/daily-automations) rather than fired
 * instantly — these automations aren't tied to something happening, just
 * to the calendar. Every confirmed event is compared against every active
 * date-based automation's day count; a match fires exactly once per event
 * (hasAutomationRunForEvent guards against the cron re-running the same
 * day and double-sending).
 */
export async function runDateBasedAutomations(origin: string): Promise<{ checked: number; ran: number }> {
  const automations = await listActiveDateBasedAutomations();
  if (automations.length === 0) return { checked: 0, ran: 0 };

  const db = createAdminClient();
  const { data: events } = await db.from("events").select("id, starts_at, created_at").eq("event_status", "confirmed");
  if (!events || events.length === 0) return { checked: 0, ran: 0 };

  const today = startOfDay(new Date());
  let ran = 0;

  for (const automation of automations as AutomationRow[]) {
    const parsed = parseDateTrigger(automation.trigger);
    if (!parsed) continue;

    for (const event of events) {
      const anchor = parsed.type === "days_after_created" ? event.created_at : event.starts_at;
      if (!anchor) continue;

      const anchorDay = startOfDay(new Date(anchor));
      const diff = parsed.type === "days_before_event" ? daysBetween(today, anchorDay) : daysBetween(anchorDay, today);
      if (diff !== parsed.days) continue;

      if (await hasAutomationRunForEvent(automation.id, event.id)) continue;

      const ctx = await loadEventContext(event.id);
      if (!ctx) continue;

      await runOne(automation, ctx, origin, {});
      ran += 1;
    }
  }

  return { checked: events.length * automations.length, ran };
}

async function runOne(automation: AutomationRow, event: EventContext, origin: string, extra: Record<string, string>): Promise<void> {
  if (!conditionsMatch(event, automation.conditions, extra)) {
    await recordAutomationRun({ automationId: automation.id, eventId: event.id, status: "skipped", detail: "Conditions did not match" });
    return;
  }

  const results: { type: string; result: string }[] = [];
  try {
    for (const action of automation.actions) {
      const result = await runAction(action, event, origin);
      results.push({ type: action.type, result });
    }
    await recordAutomationRun({ automationId: automation.id, eventId: event.id, status: "ran", actionsRun: results });
  } catch (err) {
    await recordAutomationRun({
      automationId: automation.id,
      eventId: event.id,
      status: "error",
      detail: err instanceof Error ? err.message : "Unknown error",
      actionsRun: results
    });
  }
}
