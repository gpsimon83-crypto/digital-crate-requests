import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireAdmin } from "@/lib/require-admin";
import { mergePricingConfig, DEFAULT_PRICING_CONFIG } from "@/lib/pricing";

/** Public read — guest pages need this to render live prices, no auth required. */
export async function GET() {
  try {
    const db = createAdminClient();
    const { data, error } = await db.from("pricing_settings").select("config").eq("id", true).maybeSingle();
    if (error) throw error;
    return NextResponse.json({ config: mergePricingConfig(data?.config) });
  } catch {
    // Table may not exist yet — fall back to defaults rather than break guest pages.
    return NextResponse.json({ config: DEFAULT_PRICING_CONFIG });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();

  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("pricing_settings")
      .update({ config: body })
      .eq("id", true)
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ config: mergePricingConfig(data.config) });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
