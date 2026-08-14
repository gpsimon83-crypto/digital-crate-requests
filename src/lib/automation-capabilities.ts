// Shared between the server-side automations engine and the client-side
// automation builder UI — no server-only imports here so it's safe in both.

// Event-driven triggers — fire the instant something happens.
export const TRIGGERS = [
  { value: "lead_created", label: "New Lead" },
  { value: "event_confirmed", label: "Event Confirmed" },
  { value: "event_declined", label: "Event Declined" },
  { value: "contract_signed", label: "Contract Signed" },
  { value: "questionnaire_completed", label: "Questionnaire Completed" },
  { value: "payment_received", label: "Payment Received" }
] as const;

// Date-driven triggers — checked once daily (see the daily-automations
// cron) against every confirmed event's date, not fired instantly. Stored
// as "days_before_event:7", "days_after_event:1", etc. — the number is
// part of the trigger string itself rather than a separate column, so no
// schema change was needed to add this whole category.
export const DATE_TRIGGER_TYPES = [
  { value: "days_before_event", label: "Days Before the Event" },
  { value: "days_after_event", label: "Days After the Event" },
  { value: "days_after_created", label: "Days After Booking Was Created" }
] as const;

export function buildDateTrigger(type: string, days: number): string {
  return `${type}:${days}`;
}

export function parseDateTrigger(trigger: string): { type: string; days: number } | null {
  const match = trigger.match(/^(days_before_event|days_after_event|days_after_created):(\d+)$/);
  if (!match) return null;
  return { type: match[1], days: parseInt(match[2], 10) };
}

// "payment_kind" only has a real value on the payment_received trigger
// (the kind of the payment that just fired, passed in as extra context) —
// on every other trigger it reads "". "deposit_paid" and "balance_paid"
// are historical/current-state checks computed fresh every time an
// automation fires, so they're meaningful from any trigger.
export const CONDITION_FIELDS = [
  { value: "event_type", label: "Event type" },
  { value: "service_type", label: "Service type" },
  { value: "status", label: "Status" },
  { value: "event_status", label: "Event status" },
  { value: "contract_signed", label: "Contract signed (yes/no)" },
  { value: "deposit_paid", label: "Deposit ever paid (yes/no)" },
  { value: "balance_paid", label: "Full balance paid (yes/no)" },
  { value: "payment_kind", label: "This payment's kind (deposit/balance/other)" }
];

export const ACTION_TYPES = [
  { value: "create_task", label: "Create Task" },
  { value: "notify_staff", label: "Notify Staff" },
  { value: "send_email", label: "Send Email" },
  { value: "unlock_music_plan", label: "Unlock Wedding Music Plan in portal" }
] as const;
