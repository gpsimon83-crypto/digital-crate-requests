import { createAdminClient } from "@/lib/supabase/admin";

export type EventFileCategory = "contract" | "email_attachment" | "other";
export type EventFileSource = "upload" | "email" | "library";

export interface EventFileRow {
  id: string;
  event_id: string;
  category: EventFileCategory;
  file_url: string;
  file_name: string;
  source: EventFileSource;
  email_message_id: string | null;
  uploaded_by: string | null;
  created_at: string;
}

export async function listEventFiles(eventId: string): Promise<EventFileRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("event_files").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export interface ClientEventFile extends EventFileRow {
  events: { title: string | null } | null;
}

/** Every file across every event this client has ever booked, newest first — the Client Workspace rollup. */
export async function listFilesForClient(clientId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("event_files")
    .select("*, events!inner(title, client_id)")
    .eq("events.client_id", clientId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as ClientEventFile[];
}

export interface DjEventFile extends EventFileRow {
  events: { title: string | null } | null;
}

/** Every file across every event this DJ has been assigned to, newest first — the DJ Workspace rollup. */
export async function listFilesForDj(djId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("event_files")
    .select("*, events!inner(title, dj_id)")
    .eq("events.dj_id", djId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as unknown as DjEventFile[];
}

export async function createEventFile(
  eventId: string,
  input: { category: EventFileCategory; fileUrl: string; fileName: string; source?: EventFileSource; emailMessageId?: string; uploadedBy?: string }
): Promise<EventFileRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("event_files")
    .insert({
      event_id: eventId,
      category: input.category,
      file_url: input.fileUrl,
      file_name: input.fileName,
      source: input.source ?? "upload",
      email_message_id: input.emailMessageId ?? null,
      uploaded_by: input.uploadedBy ?? null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEventFile(fileId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("event_files").delete().eq("id", fileId);
  if (error) throw error;
}
