import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { parsePackageInput, setLinks, setPackageCategories } from "@/lib/data/catalog";
import { moneyAccess } from "@/lib/money-access";
import { errorMessage } from "@/lib/error-message";

/**
 * Edit a package: name, description, coverage, pricing, features, categories,
 * included add-ons, active, and (owners/admins) the payout rule. Changes apply
 * to new offers and inquiries only: proposals, bookings, invoices and accepted
 * DJ offers keep the amounts they saved.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const money = await moneyAccess();
  const parsed = parsePackageInput(b, { creating: false, canManagePayout: money.manage });
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { row, categoryIds, includedAddonIds } = parsed.value;
  if (!Object.keys(row).length && !categoryIds && !includedAddonIds) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  try {
    const db = createAdminClient();
    if (Object.keys(row).length) {
      const { error } = await db.from("packages").update({ ...row, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    }
    if (categoryIds) await setPackageCategories(db, id, categoryIds);
    if (includedAddonIds) await setLinks(db, "package_included_addons", "package_id", id, "addon_id", includedAddonIds);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
