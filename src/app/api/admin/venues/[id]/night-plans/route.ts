import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireVenueAdmin } from "@/lib/venue/server";
import { PLAN_COLUMNS, missingPlansTable, toNightPlan } from "@/lib/venue/night-plans";

type Params = { params: Promise<{ id: string }> };

/** Staff: the venue's upcoming night plans (drink specials, occasions, DJ requests), soonest first. */
export async function GET(_req: NextRequest, { params }: Params) {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Venue not found" }, { status: 404 });
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  try {
    const { data, error } = await createAdminClient().from("venue_night_plans").select(PLAN_COLUMNS).eq("venue_id", id).gte("night_date", today).order("night_date").limit(100);
    if (missingPlansTable(error)) return NextResponse.json({ plans: [], ready: false });
    if (error) throw error;
    return NextResponse.json({ plans: (data ?? []).map((r) => toNightPlan(r as Record<string, unknown>)), ready: true });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 500 });
  }
}
