import { createAdminClient } from "@/lib/supabase/admin";

export interface ExternalBusyBlock {
  id: string;
  google_event_id: string;
  summary: string | null;
  starts_at: string;
  ends_at: string;
}

export async function listUpcomingBusyBlocks(): Promise<ExternalBusyBlock[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("external_calendar_busy_blocks")
    .select("id, google_event_id, summary, starts_at, ends_at")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data as ExternalBusyBlock[];
}

export async function upsertBusyBlock(input: { googleEventId: string; summary: string | null; startsAt: string; endsAt: string }) {
  const db = createAdminClient();
  const { error } = await db.from("external_calendar_busy_blocks").upsert(
    {
      google_event_id: input.googleEventId,
      summary: input.summary,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      updated_at: new Date().toISOString()
    },
    { onConflict: "google_event_id" }
  );
  if (error) throw error;
}

export async function removeBusyBlock(googleEventId: string) {
  const db = createAdminClient();
  const { error } = await db.from("external_calendar_busy_blocks").delete().eq("google_event_id", googleEventId);
  if (error) throw error;
}

export async function clearAllBusyBlocks() {
  const db = createAdminClient();
  const { error } = await db.from("external_calendar_busy_blocks").delete().neq("google_event_id", "");
  if (error) throw error;
}
