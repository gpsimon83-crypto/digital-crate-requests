import type { createAdminClient } from "@/lib/supabase/admin";

type Db = ReturnType<typeof createAdminClient>;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Who a client "belongs to" for email copies. A DJ's own client is one they
 * brought in themselves through Leads (the client was created as
 * "added by <that DJ>"). Everyone else (website inquiries, clients the office
 * added, or a lead that matched an existing client) is a DCDJ client.
 */
export function isDjOwnClient(client: { referral_source?: string | null } | null | undefined, djName: string | null | undefined): boolean {
  const src = client?.referral_source?.trim().toLowerCase() ?? "";
  return !!djName && src === `added by ${djName.trim().toLowerCase()}`;
}

/** The office copy address from Settings, if set (and migration 0064 is in). */
export async function officeCopyAddress(db: Db): Promise<string | null> {
  const { data, error } = await db.from("platform_settings").select("office_copy_email").eq("id", true).maybeSingle();
  if (error) return null;
  const v = (data?.office_copy_email as string | null | undefined)?.trim() ?? "";
  return EMAIL.test(v) ? v : null;
}

/** The hidden copy for one DJ email to one client: the office address for DCDJ clients, nothing for the DJ's own. */
export async function officeCopyFor(db: Db, client: { referral_source?: string | null } | null | undefined, djName: string | null | undefined): Promise<string | null> {
  if (isDjOwnClient(client, djName)) return null;
  return officeCopyAddress(db);
}
