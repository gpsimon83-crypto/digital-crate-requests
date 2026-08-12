// Auto-fill tokens for email templates — {{double_curly}} so they're
// visually distinct from the [square-bracket] placeholders templates use
// for things we don't have real data for yet (phone number, package name,
// due date, review link, etc.), which are left untouched on purpose so
// whoever's sending notices and fills them in by hand.
export interface MergeContext {
  clientFirstName?: string;
  clientFullName?: string;
  eventType?: string;
  eventDate?: string;
  eventTime?: string;
  eventEndTime?: string;
  venueName?: string;
  guestCount?: string;
  djName?: string;
  totalAmount?: string;
  depositAmount?: string;
  balanceDue?: string;
  portalLink?: string;
  schedulerLink?: string;
  eventCode?: string;
}

export const COMPANY_NAME = "Digital Crate DJs";

export const MERGE_TOKENS: { token: string; label: string }[] = [
  { token: "client_first_name", label: "Client first name" },
  { token: "client_full_name", label: "Client full name" },
  { token: "event_type", label: "Event type" },
  { token: "event_date", label: "Event date" },
  { token: "event_time", label: "Start time" },
  { token: "event_end_time", label: "End time" },
  { token: "venue_name", label: "Venue" },
  { token: "guest_count", label: "Guest count" },
  { token: "dj_name", label: "DJ name" },
  { token: "company_name", label: "Company name" },
  { token: "total_amount", label: "Total amount" },
  { token: "deposit_amount", label: "Deposit amount" },
  { token: "balance_due", label: "Balance due" },
  { token: "portal_link", label: "Client portal link" },
  { token: "scheduler_link", label: "Booking/scheduler link" },
  { token: "event_code", label: "Event code" }
];

export function fillMergeFields(text: string, ctx: MergeContext): string {
  const values: Record<string, string> = {
    client_first_name: ctx.clientFirstName || "there",
    client_full_name: ctx.clientFullName || "",
    event_type: ctx.eventType || "your event",
    event_date: ctx.eventDate || "TBD",
    event_time: ctx.eventTime || "TBD",
    event_end_time: ctx.eventEndTime || "TBD",
    venue_name: ctx.venueName || "TBD",
    guest_count: ctx.guestCount || "TBD",
    dj_name: ctx.djName || "Your DJ",
    company_name: COMPANY_NAME,
    total_amount: ctx.totalAmount || "TBD",
    deposit_amount: ctx.depositAmount || "TBD",
    balance_due: ctx.balanceDue || "$0",
    portal_link: ctx.portalLink || "",
    scheduler_link: ctx.schedulerLink || "",
    event_code: ctx.eventCode || ""
  };

  let result = text;
  for (const [key, value] of Object.entries(values)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}
