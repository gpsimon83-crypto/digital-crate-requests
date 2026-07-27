import { createAdminClient } from "@/lib/supabase/admin";

export async function listEquipment() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("equipment")
    .select("*")
    .is("deleted_at", null)
    .order("category", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return data;
}

export async function createEquipment(input: {
  category: string;
  name: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  quantityOwned?: number;
  storageLocation?: string;
}) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("equipment")
    .insert({
      category: input.category,
      name: input.name,
      brand: input.brand || null,
      model: input.model || null,
      serial_number: input.serialNumber || null,
      quantity_owned: input.quantityOwned ?? 1,
      storage_location: input.storageLocation || null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateEquipment(equipmentId: string, updates: Record<string, unknown>) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("equipment")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", equipmentId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteEquipment(equipmentId: string) {
  const db = createAdminClient();
  const { error } = await db.from("equipment").update({ deleted_at: new Date().toISOString() }).eq("id", equipmentId);
  if (error) throw error;
}
