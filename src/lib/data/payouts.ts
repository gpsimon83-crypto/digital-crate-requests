import { createAdminClient } from "@/lib/supabase/admin";

export interface PayoutRow {
  id: string;
  event_id: string;
  dj_id: string;
  amount_cents: number;
  status: "pending" | "paid";
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  events?: { title: string | null; starts_at: string | null } | null;
  djs?: { display_name: string } | null;
}

export async function listPayouts(): Promise<PayoutRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("payouts")
    .select("*, events(title, starts_at), djs(display_name)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listPayoutsForDj(djId: string): Promise<PayoutRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("payouts")
    .select("*, events(title, starts_at)")
    .eq("dj_id", djId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function listPayoutsForEvent(eventId: string): Promise<PayoutRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("payouts").select("*, djs(display_name)").eq("event_id", eventId).order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createPayout(input: { eventId: string; djId: string; amountCents: number; notes?: string }): Promise<PayoutRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("payouts")
    .insert({ event_id: input.eventId, dj_id: input.djId, amount_cents: input.amountCents, notes: input.notes ?? null })
    .select("*, events(title, starts_at), djs(display_name)")
    .single();
  if (error) throw error;
  return data;
}

export async function updatePayout(
  id: string,
  updates: Partial<{ amountCents: number; notes: string | null; status: "pending" | "paid" }>
): Promise<PayoutRow> {
  const db = createAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.amountCents !== undefined) patch.amount_cents = updates.amountCents;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.status !== undefined) {
    patch.status = updates.status;
    patch.paid_at = updates.status === "paid" ? new Date().toISOString() : null;
  }
  const { data, error } = await db.from("payouts").update(patch).eq("id", id).select("*, events(title, starts_at), djs(display_name)").single();
  if (error) throw error;
  return data;
}

export async function deletePayout(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("payouts").delete().eq("id", id);
  if (error) throw error;
}
