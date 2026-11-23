import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePackageInput, setLinks, setPackageCategories } from "@/lib/data/catalog";
import { moneyAccess } from "@/lib/money-access";
import { errorMessage } from "@/lib/error-message";

/** Add a package, with its categories, included add-ons and (for owners/admins) its payout rule. */
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const money = await moneyAccess();
  const parsed = parsePackageInput(b, { creating: true, canManagePayout: money.manage });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  try {
    const db = createAdminClient();
    const { data: last } = await db.from("packages").select("position").order("position", { ascending: false }).limit(1).maybeSingle();
    const { data, error } = await db.from("packages").insert({ ...parsed.value.row, position: ((last as { position: number } | null)?.position ?? -1) + 1 }).select("id").single();
    if (error) throw error;
    const id = (data as { id: string }).id;
    if (parsed.value.categoryIds) await setPackageCategories(db, id, parsed.value.categoryIds);
    if (parsed.value.includedAddonIds) await setLinks(db, "package_included_addons", "package_id", id, "addon_id", parsed.value.includedAddonIds);
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
