import { createAdminClient } from "@/lib/supabase/admin";
import { deriveEventCategory } from "@/lib/event-category";
import { zonedTimeToUtc } from "@/lib/scheduler-time";
import { loadAdminCatalog, packageSnapshot, toPublicCatalog } from "@/lib/data/catalog";

function generateEventCode(title: string) {
  const slug =
    title
      .split(" ")[0]
      .replace(/[^a-zA-Z0-9]/g, "")
      .toUpperCase()
      .slice(0, 8) || "EVENT";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug}-${suffix}`;
}

/**
 * Public booking-inquiry submission from the marketing homepage. Unlike
 * the admin client/event APIs, this has no auth — it's the front door for
 * strangers who've never been in the system before. Finds an existing
 * client by email so a repeat inquirer doesn't get duplicated, otherwise
 * creates one. Always creates a new events row with status 'inquiry' —
 * the same table admin/events and the DJ dashboard's "Bookings" view
 * already use, just entering at the earliest lifecycle stage.
 */
export async function createInquiry(input: {
  name: string;
  email: string;
  phone?: string;
  eventDate: string;
  eventType: string;
  preferredDjId?: string;
  message?: string;
  venueName?: string;
  expectedGuests?: number;
  budgetRange?: string;
  /** Where the lead came from, for a new client (default: the website form). */
  source?: string;
  /** The Services package they asked about. */
  packageId?: string;
}) {
  const db = createAdminClient();

  const { data: existingClient } = await db.from("clients").select("id").eq("email", input.email).is("deleted_at", null).maybeSingle();

  let clientId = existingClient?.id as string | undefined;

  if (!clientId) {
    const [firstName, ...rest] = input.name.trim().split(" ");
    const { data: newClient, error: clientError } = await db
      .from("clients")
      .insert({
        type: "individual",
        first_name: firstName || input.name,
        last_name: rest.join(" ") || null,
        email: input.email,
        phone: input.phone || null,
        referral_source: input.source || "website booking form"
      })
      .select("id")
      .single();
    if (clientError) throw clientError;
    clientId = newClient.id;
  }

  const { data: event, error: eventError } = await db
    .from("events")
    .insert({
      event_code: generateEventCode(input.eventType),
      title: `${input.eventType} inquiry — ${input.name}`,
      client_id: clientId,
      dj_id: input.preferredDjId || null,
      // eventDate is a calendar date (YYYY-MM-DD). Store it as midday in the
      // business timezone so it reads as the same day everywhere in the US;
      // `new Date("YYYY-MM-DD")` is midnight UTC, the previous evening in Chicago.
      starts_at: /^\d{4}-\d{2}-\d{2}$/.test(input.eventDate) ? zonedTimeToUtc(input.eventDate, "12:00").toISOString() : new Date(input.eventDate).toISOString(),
      status: "inquiry",
      event_status: "tentative",
      event_type: input.eventType,
      event_category: deriveEventCategory(input.eventType),
      special_requests: input.message || null,
      venue_name: input.venueName || null,
      expected_guests: input.expectedGuests || null,
      budget_range: input.budgetRange || null
    })
    .select()
    .single();
  if (eventError) throw eventError;

  // The package they asked about, frozen as shown (name, price, inclusions):
  // later catalog edits never change what this inquiry asked for.
  if (input.packageId) {
    try {
      const cats = toPublicCatalog(await loadAdminCatalog(db, { withPayout: false }));
      const hit = cats.flatMap((c) => c.packages.map((p) => ({ p, c }))).find((x) => x.p.id === input.packageId);
      if (hit) {
        const snap = packageSnapshot(hit.p, hit.c.name);
        await db.from("events").update({ package_id: hit.p.id, package_snapshot: snap }).eq("id", event.id);
        return { ...event, package_id: hit.p.id, package_snapshot: snap };
      }
    } catch {
      // The inquiry still goes through without the package.
    }
  }

  return event;
}
