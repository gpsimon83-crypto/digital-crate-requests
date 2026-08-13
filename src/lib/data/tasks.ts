import { createAdminClient } from "@/lib/supabase/admin";

export interface TaskRow {
  id: string;
  event_id: string;
  title: string;
  due_date: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
}

export async function listTasks(eventId: string): Promise<TaskRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("tasks").select("*").eq("event_id", eventId).order("due_date", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function createTask(eventId: string, input: { title: string; dueDate?: string | null; createdBy?: string | null }): Promise<TaskRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("tasks")
    .insert({ event_id: eventId, title: input.title, due_date: input.dueDate ?? null, created_by: input.createdBy ?? null })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateTask(taskId: string, updates: { title?: string; dueDate?: string | null; completed?: boolean }): Promise<TaskRow> {
  const db = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.dueDate !== undefined) patch.due_date = updates.dueDate;
  if (updates.completed !== undefined) patch.completed_at = updates.completed ? new Date().toISOString() : null;

  const { data, error } = await db.from("tasks").update(patch).eq("id", taskId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteTask(taskId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}
