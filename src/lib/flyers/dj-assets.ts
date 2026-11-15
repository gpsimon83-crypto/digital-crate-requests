import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

/**
 * A DJ's approved flyer picture of one kind: the one marked preferred, else
 * the newest approved one. Never guessed from file names: only images in
 * this DJ's own library, of that type, approved by staff.
 */
export async function preferredDjAsset(db: Db, djId: string, kind: "cutout" | "name_logo"): Promise<{ id: string; storage_path: string; mime: string } | null> {
  const { data, error } = await db
    .from("flyer_assets")
    .select("id, storage_path, mime, approved, is_primary, created_at")
    .eq("owner_dj_id", djId)
    .eq("kind", kind)
    .order("created_at", { ascending: false });
  if (error) return null; // before migration 0052 these types don't exist yet
  const rows = ((data ?? []) as { id: string; storage_path: string; mime: string; approved: boolean; is_primary: boolean }[]).filter((r) => r.approved);
  return rows.find((r) => r.is_primary) ?? rows[0] ?? null;
}
