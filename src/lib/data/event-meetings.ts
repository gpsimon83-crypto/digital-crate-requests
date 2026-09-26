import { createAdminClient } from "@/lib/supabase/admin";

export interface MeetingRow {
  id: string;
  event_id: string;
  starts_at: string;
  ends_at: string;
  location: string | null;
  meeting_url: string | null;
  notes: string | null;
  status: "scheduled" | "cancelled";
  created_by: string | null;
  created_at: string;
}

export async function listMeetings(eventId: string): Promise<MeetingRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("event_meetings").select("*").eq("event_id", eventId).order("starts_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listUpcomingMeetingsForClient(eventId: string): Promise<MeetingRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("event_meetings")
    .select("*")
    .eq("event_id", eventId)
    .eq("status", "scheduled")
    .gte("ends_at", new Date().toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function listUpcomingMeetingsForCalendar() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("event_meetings")
    .select("id, event_id, starts_at, ends_at, location, meeting_url, events(title)")
    .eq("status", "scheduled")
    .gte("ends_at", new Date(Date.now() - 31 * 86400000).toISOString())
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data;
}

export interface MeetingInput {
  startsAt: string;
  endsAt: string;
  location?: string | null;
  meetingUrl?: string | null;
  notes?: string | null;
}

export async function createMeeting(eventId: string, input: MeetingInput & { createdBy?: string | null }): Promise<MeetingRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("event_meetings")
    .insert({
      event_id: eventId,
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      location: input.location || null,
      meeting_url: input.meetingUrl || null,
      notes: input.notes || null,
      created_by: input.createdBy ?? null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Always scoped by event_id so a caller with access to one project can't
// touch another project's meeting by guessing its id.
export async function updateMeeting(eventId: string, meetingId: string, input: MeetingInput): Promise<MeetingRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("event_meetings")
    .update({
      starts_at: input.startsAt,
      ends_at: input.endsAt,
      location: input.location || null,
      meeting_url: input.meetingUrl || null,
      notes: input.notes || null
    })
    .eq("id", meetingId)
    .eq("event_id", eventId)
    .eq("status", "scheduled")
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function cancelMeeting(eventId: string, meetingId: string): Promise<MeetingRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("event_meetings")
    .update({ status: "cancelled" })
    .eq("id", meetingId)
    .eq("event_id", eventId)
    .eq("status", "scheduled")
    .select()
    .single();
  if (error) throw error;
  return data;
}
