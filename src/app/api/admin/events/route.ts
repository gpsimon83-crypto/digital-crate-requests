import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { listEvents, createEvent } from "@/lib/data/events";
import { requireAuth } from "@/lib/require-auth";
import { requireAdmin } from "@/lib/require-admin";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isStaffRole } from "@/lib/roles";

/**
 * Staff see every event, same as always. A DJ used to get the exact same
 * unfiltered response (client PII, financials, every other DJ's bookings)
 * and relied on the browser to filter it down — this scopes it server-side
 * instead, matching the ownership check already used on the single-event
 * route (requireEventAccess).
 */
export async function GET() {
  const denied = await requireAuth();
  if (denied) return denied;

  try {
    const events = await listEvents();

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user && !isStaffRole(user.user_metadata?.role)) {
      const db = createAdminClient();
      const { data: dj } = await db.from("djs").select("id").eq("auth_user_id", user.id).maybeSingle();
      const scoped = dj ? events.filter((e) => e.dj_id === dj.id) : [];
      return NextResponse.json({ events: scoped });
    }

    return NextResponse.json({ events });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}

export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const body = await req.json();
  const { title, djId, venueId, clientId, startsAt, endsAt, eventType, serviceType, expectedGuests, quotedAmount } = body;

  if (!title || !startsAt) {
    return NextResponse.json({ error: "title and startsAt are required" }, { status: 400 });
  }
  if (!clientId) {
    return NextResponse.json({ error: "clientId is required — every project needs a linked contact" }, { status: 400 });
  }

  try {
    const event = await createEvent({
      title,
      djId,
      venueId,
      clientId,
      startsAt,
      endsAt,
      eventType,
      serviceType,
      expectedGuests,
      quotedAmount,
    });
    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
