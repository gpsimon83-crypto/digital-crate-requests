import { createAdminClient } from "@/lib/supabase/admin";
import {
  listActiveAutomationsForTrigger,
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
import { TRIGGERS } from "@/lib/automation-capabilities";

export { TRIGGERS };

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
  contract_signed_at: string | null;
  dj_id: string | null;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
  clients: { first_name: string | null; last_name: string | null; company_name: string | null; email: string | null } | null;
  hasDepositPayment: boolean;
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
      return event.contract_signed_at ? "yes" : "no";
    case "deposit_paid":
      return event.hasDepositPayment ? "yes" : "no";
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

    const db = createAdminClient();
    const { data: event, error } = await db
      .from("events")
      .select(
        "id, event_code, title, event_type, service_type, status, event_status, starts_at, ends_at, contract_signed_at, dj_id, djs(display_name), venues(name), clients(first_name, last_name, company_name, email)"
      )
      .eq("id", eventId)
      .single();
    if (error || !event) return;

    const { data: deposit } = await db.from("payments").select("id").eq("event_id", eventId).eq("kind", "deposit").eq("status", "succeeded").limit(1).maybeSingle();

    const ctx: EventContext = { ...(event as unknown as EventContext), hasDepositPayment: !!deposit };

    for (const automation of automations as AutomationRow[]) {
      await runOne(automation, ctx, origin, extra);
    }
  } catch {
    // best-effort — automations never block the flow that triggered them
  }
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
