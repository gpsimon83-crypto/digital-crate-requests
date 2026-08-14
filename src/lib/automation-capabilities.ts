// Shared between the server-side automations engine and the client-side
// automation builder UI — no server-only imports here so it's safe in both.

export const TRIGGERS = [
  { value: "lead_created", label: "New Lead" },
  { value: "event_confirmed", label: "Event Confirmed" },
  { value: "event_declined", label: "Event Declined" },
  { value: "contract_signed", label: "Contract Signed" },
  { value: "questionnaire_completed", label: "Questionnaire Completed" },
  { value: "payment_received", label: "Payment Received" }
] as const;

// "payment_kind" only has a real value on the payment_received trigger
// (the kind of the payment that just fired, passed in as extra context) —
// on every other trigger it reads "". "deposit_paid" is a historical
// existence check (has this event ever had a succeeded deposit payment),
// so it's meaningful from any trigger.
export const CONDITION_FIELDS = [
  { value: "event_type", label: "Event type" },
  { value: "service_type", label: "Service type" },
  { value: "status", label: "Status" },
  { value: "event_status", label: "Event status" },
  { value: "contract_signed", label: "Contract signed (yes/no)" },
  { value: "deposit_paid", label: "Deposit ever paid (yes/no)" },
  { value: "payment_kind", label: "This payment's kind (deposit/balance/other)" }
];

export const ACTION_TYPES = [
  { value: "create_task", label: "Create Task" },
  { value: "notify_staff", label: "Notify Staff" },
  { value: "send_email", label: "Send Email" },
  { value: "unlock_music_plan", label: "Unlock Wedding Music Plan in portal" }
] as const;
