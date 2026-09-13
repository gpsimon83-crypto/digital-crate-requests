import { createAdminClient } from "@/lib/supabase/admin";

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

/**
 * Forward-only auto-advance: a contract signing or a deposit landing
 * should never regress a deal that's already moved further along (e.g. a
 * re-signed contract on an event already in "Planning" shouldn't snap it
 * back to "Proposal Signed"), and never touches a terminal stage
 * (Declined/Archived) that a human deliberately set.
 */
export async function maybeAdvancePipelineStage(eventId: string, targetStage: PipelineStage) {
  const db = createAdminClient();
  const { data: event } = await db.from("events").select("pipeline_stage").eq("id", eventId).maybeSingle();
  const current = (event?.pipeline_stage as PipelineStage | null) ?? "Inquiry";

  if (current === "Declined" || current === "Archived") return;

  const currentIndex = PIPELINE_STAGES.indexOf(current);
  const targetIndex = PIPELINE_STAGES.indexOf(targetStage);
  if (targetIndex <= currentIndex) return;

  await db.from("events").update({ pipeline_stage: targetStage }).eq("id", eventId);
}

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
