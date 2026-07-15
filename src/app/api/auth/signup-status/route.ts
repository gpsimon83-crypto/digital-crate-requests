import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

/** Public check so the signup page knows whether to render the form. */
export async function GET() {
  try {
    const db = createAdminClient();
    const { data } = await db
      .from("platform_settings")
      .select("allow_dj_self_registration")
      .eq("id", true)
      .maybeSingle();
    return NextResponse.json({ enabled: data?.allow_dj_self_registration ?? true });
  } catch {
    return NextResponse.json({ enabled: true });
  }
}
