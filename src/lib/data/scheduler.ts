import { createAdminClient } from "@/lib/supabase/admin";

export interface AvailabilityRow {
  day_of_week: number;
  enabled: boolean;
  start_time: string;
  end_time: string;
}

export async function getAvailability(): Promise<AvailabilityRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("scheduler_availability").select("*").order("day_of_week");
  if (error) throw error;
  return data;
}

export async function updateAvailability(
  rows: { dayOfWeek: number; enabled: boolean; startTime: string; endTime: string }[]
) {
  const db = createAdminClient();
  for (const r of rows) {
    const { error } = await db
      .from("scheduler_availability")
      .update({ enabled: r.enabled, start_time: r.startTime, end_time: r.endTime })
      .eq("day_of_week", r.dayOfWeek);
    if (error) throw error;
  }
  return getAvailability();
}

export async function getSlotMinutes(): Promise<number> {
  const db = createAdminClient();
  const { data, error } = await db.from("scheduler_settings").select("slot_minutes").eq("id", true).maybeSingle();
  if (error) throw error;
  return data?.slot_minutes ?? 30;
}

export async function updateSlotMinutes(minutes: number) {
  const db = createAdminClient();
  const { error } = await db.from("scheduler_settings").update({ slot_minutes: minutes }).eq("id", true);
  if (error) throw error;
}

/**
 * A generous +/- 1 day UTC window around the target calendar date, since a
 * business-local day can straddle two UTC dates — callers filter precisely
 * by business-local date themselves (see utcToZonedDateStr).
 */
export async function getConsultationEventsOnDate(dateStr: string) {
  const db = createAdminClient();
  const dayStartUtc = new Date(`${dateStr}T00:00:00Z`);
  const rangeStart = new Date(dayStartUtc.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const rangeEnd = new Date(dayStartUtc.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from("events")
    .select("id, starts_at, ends_at, status")
    .eq("event_type", "consultation")
    .neq("status", "declined")
    .gte("starts_at", rangeStart)
    .lte("starts_at", rangeEnd);
  if (error) throw error;
  return data;
}
