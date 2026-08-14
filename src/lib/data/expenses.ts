import { createAdminClient } from "@/lib/supabase/admin";

export interface ExpenseRow {
  id: string;
  description: string;
  amount_cents: number;
  category: string | null;
  event_id: string | null;
  incurred_on: string;
  created_at: string;
  events?: { title: string | null } | null;
}

export async function listExpenses(): Promise<ExpenseRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("expenses").select("*, events(title)").order("incurred_on", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createExpense(input: {
  description: string;
  amountCents: number;
  category?: string;
  eventId?: string;
  incurredOn?: string;
  createdBy?: string;
}): Promise<ExpenseRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("expenses")
    .insert({
      description: input.description,
      amount_cents: input.amountCents,
      category: input.category || null,
      event_id: input.eventId || null,
      incurred_on: input.incurredOn || new Date().toISOString().slice(0, 10),
      created_by: input.createdBy || null
    })
    .select("*, events(title)")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExpense(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("expenses").delete().eq("id", id);
  if (error) throw error;
}
