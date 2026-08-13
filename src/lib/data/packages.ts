import { createAdminClient } from "@/lib/supabase/admin";

export interface PackageRow {
  id: string;
  name: string;
  description: string;
  price: number;
  hours: number | null;
  features: string[];
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PackageAddonRow {
  id: string;
  name: string;
  description: string;
  price: number;
  position: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function listPackages(includeInactive = false): Promise<PackageRow[]> {
  const db = createAdminClient();
  let query = db.from("packages").select("*").order("position");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createPackage(input: {
  name: string;
  description: string;
  price: number;
  hours?: number | null;
  features?: string[];
  position?: number;
}): Promise<PackageRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("packages")
    .insert({
      name: input.name,
      description: input.description,
      price: input.price,
      hours: input.hours ?? null,
      features: input.features ?? [],
      position: input.position ?? 0
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePackage(
  id: string,
  updates: Partial<{ name: string; description: string; price: number; hours: number | null; features: string[]; position: number; isActive: boolean }>
): Promise<PackageRow> {
  const db = createAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.price !== undefined) patch.price = updates.price;
  if (updates.hours !== undefined) patch.hours = updates.hours;
  if (updates.features !== undefined) patch.features = updates.features;
  if (updates.position !== undefined) patch.position = updates.position;
  if (updates.isActive !== undefined) patch.is_active = updates.isActive;

  const { data, error } = await db.from("packages").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePackage(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("packages").delete().eq("id", id);
  if (error) throw error;
}

export async function listPackageAddons(includeInactive = false): Promise<PackageAddonRow[]> {
  const db = createAdminClient();
  let query = db.from("package_addons").select("*").order("position");
  if (!includeInactive) query = query.eq("is_active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createPackageAddon(input: { name: string; description: string; price: number; position?: number }): Promise<PackageAddonRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("package_addons")
    .insert({ name: input.name, description: input.description, price: input.price, position: input.position ?? 0 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePackageAddon(
  id: string,
  updates: Partial<{ name: string; description: string; price: number; position: number; isActive: boolean }>
): Promise<PackageAddonRow> {
  const db = createAdminClient();
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.name !== undefined) patch.name = updates.name;
  if (updates.description !== undefined) patch.description = updates.description;
  if (updates.price !== undefined) patch.price = updates.price;
  if (updates.position !== undefined) patch.position = updates.position;
  if (updates.isActive !== undefined) patch.is_active = updates.isActive;

  const { data, error } = await db.from("package_addons").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deletePackageAddon(id: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("package_addons").delete().eq("id", id);
  if (error) throw error;
}
