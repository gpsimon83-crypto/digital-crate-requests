import { createAdminClient } from "@/lib/supabase/admin";

function generateEventCode(title: string) {
  const slug = title
    .split(" ")[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8) || "EVENT";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug}-${suffix}`;
}

export async function listEvents() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .select("*, djs(display_name, photo_url), venues(name)")
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createEvent(input: {
  title: string;
  djId?: string;
  venueId?: string;
  startsAt: string;
  endsAt?: string;
  status?: string;
}) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .insert({
      event_code: generateEventCode(input.title),
      title: input.title,
      dj_id: input.djId || null,
      venue_id: input.venueId || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt || null,
      status: input.status ?? "pending_confirmation",
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function confirmEvent(eventId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .update({ status: "confirmed" })
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function declineEvent(eventId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .update({ status: "declined" })
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function startEvent(eventId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .update({ status: "live" })
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function closeEvent(eventId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .update({ status: "ended" })
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
