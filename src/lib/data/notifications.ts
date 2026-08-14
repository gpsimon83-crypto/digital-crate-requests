import { createAdminClient } from "@/lib/supabase/admin";

export interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  entity_type: string | null;
  entity_id: string | null;
  event_id: string | null;
  read_at: string | null;
  created_at: string;
}

export async function listNotificationsForUser(userId: string): Promise<NotificationRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

export async function markNotificationRead(id: string, userId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", userId).is("read_at", null);
  if (error) throw error;
}
