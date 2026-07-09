import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_SETTINGS = {
  require_disclaimer_acceptance: true,
  crowd_vote_boosts_enabled: true,
};

/** Public read — guest pages need these flags to render correctly, no auth required. */
export async function GET() {
  try {
    const db = createAdminClient();
    const { data, error } = await db
      .from("platform_settings")
      .select("require_disclaimer_acceptance, crowd_vote_boosts_enabled")
      .eq("id", true)
      .maybeSingle();
    if (error) throw error;
    return NextResponse.json({ settings: data ?? DEFAULT_SETTINGS });
  } catch {
    return NextResponse.json({ settings: DEFAULT_SETTINGS });
  }
}
