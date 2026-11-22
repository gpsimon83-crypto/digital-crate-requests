import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorMessage } from "@/lib/error-message";
import { createInquiry } from "@/lib/data/inquiries";
import { notifyStaff } from "@/lib/notify-submission";
import { EVENT_TYPES } from "@/lib/event-types";
import { djRowForUser } from "@/lib/view-as";
import { enforce, supabaseRateLimitStore } from "@/lib/security/rate-limit";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

/**
 * A DJ adds a client lead they found themselves. It goes in the same way a
 * website inquiry does (same client matching, same "inquiry" project),
 * assigned to that DJ, and the office is told. Quotes, contracts and
 * payments stay with the office.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const db = createAdminClient();
  const dj = await djRowForUser<{ id: string; display_name: string }>(db, user.id, "id, display_name");
  if (!dj) return NextResponse.json({ error: "Your login isn't linked to a DJ profile yet. Ask the office to link it." }, { status: 403 });

  const rl = await enforce(supabaseRateLimitStore, [{ bucket: `dj-lead:${dj.id}`, limit: 30, window: 60 * 60 }]).catch(() => ({ allowed: true, retryAfterSeconds: 0 }));
  if (!rl.allowed) return NextResponse.json({ error: "That's a lot of leads in an hour. Try again a little later." }, { status: 429 });

  const b = await req.json().catch(() => ({}));
  const name = clean(b.name, 120);
  const email = clean(b.email, 254).toLowerCase();
  const phone = clean(b.phone, 40);
  const eventDate = clean(b.eventDate, 10);
  const eventType = (EVENT_TYPES as readonly string[]).includes(b.eventType) ? (b.eventType as string) : "Other";
  const venueName = clean(b.venueName, 160);
  const message = typeof b.message === "string" ? b.message.trim().slice(0, 2000) : "";
  const guests = Number.isFinite(Number(b.expectedGuests)) && Number(b.expectedGuests) > 0 ? Math.min(100000, Math.round(Number(b.expectedGuests))) : undefined;

  if (name.length < 2) return NextResponse.json({ error: "Add the client's name." }, { status: 400 });
  if (!EMAIL.test(email)) return NextResponse.json({ error: "Add a valid email for the client." }, { status: 400 });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate) || Number.isNaN(Date.parse(eventDate))) return NextResponse.json({ error: "Pick the event date." }, { status: 400 });

  try {
    const event = await createInquiry({
      name,
      email,
      phone: phone || undefined,
      eventDate,
      eventType,
      preferredDjId: dj.id,
      message: message || undefined,
      venueName: venueName || undefined,
      expectedGuests: guests,
      source: `added by ${dj.display_name}`
    });
    await notifyStaff({
      type: "dj_lead",
      title: `New lead from ${dj.display_name}`,
      body: `${eventType} on ${eventDate} for ${name}. Assigned to ${dj.display_name}.`,
      eventId: event.id
    }).catch(() => {});
    return NextResponse.json({ lead: { id: event.id, title: event.title } });
  } catch (err) {
    return NextResponse.json({ error: errorMessage(err) }, { status: 503 });
  }
}
