import { NextRequest, NextResponse } from "next/server";
import { errorMessage } from "@/lib/error-message";
import { getEventByCode } from "@/lib/data/requests";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { accountRole, isStaffRole } from "@/lib/roles";
import { staffSessionMeetsMfa } from "@/lib/security/mfa";

/** What a guest page may see. Event codes are short and printed on QR signs, so they're not secrets. */
const PUBLIC_EVENT = "id, event_code, title, status, starts_at, ends_at, event_type, hero_image_url, guest_request_settings, dj_id, venue_id, djs(id, display_name, photo_url, hero_settings), venues(id, name)";

/**
 * Event lookup by code. Guests (the public request pages) get only the
 * public fields above. Staff and the event's assigned DJ get the full
 * record their dashboards use. Client details, pricing, notes and DJ
 * contact info are never returned to the public.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  if (!/^[A-Za-z0-9-]{3,40}$/.test(code)) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const isStaff = isStaffRole(accountRole(user)) && (await staffSessionMeetsMfa(supabase));
      const event = await getEventByCode(code);
      if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
      if (isStaff) return NextResponse.json({ event });
      const { data: dj } = await createAdminClient().from("djs").select("id").eq("auth_user_id", user.id).maybeSingle();
      if (dj && event.dj_id === dj.id) return NextResponse.json({ event });
    }

    const { data, error } = await createAdminClient().from("events").select(PUBLIC_EVENT).eq("event_code", code).maybeSingle();
    if (error || !data) return NextResponse.json({ error: "Event not found" }, { status: 404 });
    return NextResponse.json({ event: data });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
