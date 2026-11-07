import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { requireVenueAdmin } from "@/lib/venue/server";

/** Venue directory for Admin → Venues: portal status and manager counts. */
export async function GET() {
  const admin = await requireVenueAdmin();
  if (admin instanceof NextResponse) return admin;
  try {
    const db = createAdminClient();
    const [{ data: venues, error }, { data: managers, error: mErr }] = await Promise.all([
      db.from("venues").select("id, name, location, city, state, is_active, portal_enabled, logo_url, cover_url").order("name"),
      db.from("venue_managers").select("venue_id, is_active")
    ]);
    if (error) throw error;
    // Before the venue portal migration runs, venue_managers won't exist yet.
    const counts = new Map<string, number>();
    if (!mErr) for (const m of managers ?? []) if (m.is_active) counts.set(m.venue_id, (counts.get(m.venue_id) ?? 0) + 1);
    return NextResponse.json({
      migrated: !mErr,
      venues: (venues ?? []).map((v) => ({ ...v, managers: counts.get(v.id) ?? 0 }))
    });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
