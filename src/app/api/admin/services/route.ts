import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/require-admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAdminCatalog } from "@/lib/data/catalog";
import { moneyAccess } from "@/lib/money-access";
import { errorMessage } from "@/lib/error-message";

/** The whole catalog for the Services page. Payout rules only for people allowed to see them. */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const money = await moneyAccess();
    const catalog = await loadAdminCatalog(createAdminClient(), { withPayout: money.view });
    return NextResponse.json({ ...catalog, money: { view: money.view, manage: money.manage } }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
