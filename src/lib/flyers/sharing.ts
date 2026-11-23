import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;
export type ShareMode = "all" | "selected" | "office";
export const SHARE_MODES: ShareMode[] = ["all", "selected", "office"];

/** "All DJs", "3 DJs", "Office only". */
export function shareLabel(mode: ShareMode, count: number) {
  return mode === "all" ? "All DJs" : mode === "office" ? "Office only" : count === 1 ? "1 DJ" : `${count} DJs`;
}

/** Can this DJ use the template? Pure, for tests and the UI. */
export function canUseTemplate(mode: ShareMode | null | undefined, sharedWith: string[], djId: string | null) {
  if (!mode || mode === "all") return true;
  if (mode === "office") return false;
  return !!djId && sharedWith.includes(djId);
}

/**
 * Which templates the caller may start a flyer from. Staff: all of them.
 * A DJ: "all" templates, plus "selected" ones they're on. Before migration
 * 0068 every template counts as "all".
 */
export async function templateAccess(db: Db, actor: { staff: boolean; djId: string | null }): Promise<(templateId: string) => boolean> {
  if (actor.staff) return () => true;
  const { data, error } = await db.from("flyer_templates").select("id, share_mode");
  if (error) return () => true;
  const modes = new Map(((data ?? []) as { id: string; share_mode: ShareMode }[]).map((t) => [t.id, t.share_mode]));
  const { data: shares } = actor.djId ? await db.from("flyer_template_shares").select("template_id").eq("dj_id", actor.djId) : { data: [] };
  const mine = new Set(((shares ?? []) as { template_id: string }[]).map((s) => s.template_id));
  return (id) => {
    const m = modes.get(id) ?? "all";
    return m === "all" || (m === "selected" && mine.has(id));
  };
}

/** Sharing for every template (staff list). Empty before migration 0068. */
export async function sharesByTemplate(db: Db): Promise<{ ready: boolean; modes: Map<string, ShareMode>; djs: Map<string, string[]> }> {
  const { data, error } = await db.from("flyer_templates").select("id, share_mode");
  if (error) return { ready: false, modes: new Map(), djs: new Map() };
  const { data: shares } = await db.from("flyer_template_shares").select("template_id, dj_id");
  const djs = new Map<string, string[]>();
  for (const s of (shares ?? []) as { template_id: string; dj_id: string }[]) djs.set(s.template_id, [...(djs.get(s.template_id) ?? []), s.dj_id]);
  return { ready: true, modes: new Map(((data ?? []) as { id: string; share_mode: ShareMode }[]).map((t) => [t.id, t.share_mode])), djs };
}
