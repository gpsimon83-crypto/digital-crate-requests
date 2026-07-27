import { createAdminClient } from "@/lib/supabase/admin";

export async function listClients() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("clients")
    .select("*")
    .is("deleted_at", null)
    .order("company_name", { ascending: true, nullsFirst: false })
    .order("last_name", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return data;
}

export async function getClient(clientId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("clients")
    .select("*, events(id, title, starts_at, status, final_amount)")
    .eq("id", clientId)
    .single();
  if (error) throw error;
  return data;
}

export async function createClientRecord(input: {
  type?: string;
  companyName?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  referralSource?: string;
  notes?: string;
  tags?: string[];
}) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("clients")
    .insert({
      type: input.type ?? "individual",
      company_name: input.companyName || null,
      first_name: input.firstName || null,
      last_name: input.lastName || null,
      email: input.email || null,
      phone: input.phone || null,
      address_line1: input.addressLine1 || null,
      city: input.city || null,
      state: input.state || null,
      postal_code: input.postalCode || null,
      referral_source: input.referralSource || null,
      notes: input.notes || null,
      tags: input.tags ?? []
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateClient(clientId: string, updates: Record<string, unknown>) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("clients")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", clientId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteClient(clientId: string) {
  const db = createAdminClient();
  const { error } = await db.from("clients").update({ deleted_at: new Date().toISOString() }).eq("id", clientId);
  if (error) throw error;
}
