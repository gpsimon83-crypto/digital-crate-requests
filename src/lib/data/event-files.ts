import { createAdminClient } from "@/lib/supabase/admin";

export type EventFileCategory = "contract" | "email_attachment" | "other";
export type EventFileSource = "upload" | "email";

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
