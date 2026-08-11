// Client-facing sales/planning funnel, modeled on the HoneyBook pipeline —
// deliberately separate from `status`, which keeps driving DJ confirm/
// decline, Calendar, Finance, and Reports unchanged.
export const PIPELINE_STAGES = [
  "Inquiry",
  "Follow-up",
  "Meeting",
  "Proposal Sent",
  "Proposal Signed",
  "Retainer Paid",
  "Planning",
  "Live",
  "Completed",
  "Declined",
  "Archived"
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number];

export const PIPELINE_STAGE_DOT: Record<string, string> = {
  Inquiry: "muted",
  "Follow-up": "muted",
  Meeting: "pending",
  "Proposal Sent": "pending",
  "Proposal Signed": "approved",
  "Retainer Paid": "approved",
  Planning: "approved",
  Live: "played",
  Completed: "approved",
  Declined: "declined",
  Archived: "muted"
};
