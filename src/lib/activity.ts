import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Best-effort activity write — never throws, never blocks the caller. The
 * action it's logging has already succeeded by the time this runs; a
 * failed log entry shouldn't turn that into a 500.
 */
export async function logActivity(input: {
  actorUserId?: string | null;
  actorLabel?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  eventId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    const db = createAdminClient();
    await db.from("activity_log").insert({
      actor_user_id: input.actorUserId ?? null,
      actor_label: input.actorLabel ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      event_id: input.eventId ?? null,
      metadata: input.metadata ?? {}
    });
  } catch {
    // soft no-op — activity_log is informational, not load-bearing
  }
}
