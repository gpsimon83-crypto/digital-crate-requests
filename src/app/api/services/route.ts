import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAdminCatalog, toPublicCatalog } from "@/lib/data/catalog";

/** Public: the bookable packages and add-ons by event category. No payout, cost or internal fields. */
export async function GET() {
  try {
    const catalog = await loadAdminCatalog(createAdminClient(), { withPayout: false });
    return NextResponse.json({ categories: catalog.ready ? toPublicCatalog(catalog) : [] }, { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=300" } });
  } catch {
    return NextResponse.json({ categories: [] });
  }
}
