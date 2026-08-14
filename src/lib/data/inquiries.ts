import { createAdminClient } from "@/lib/supabase/admin";

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
        referral_source: "website booking form"
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
      starts_at: new Date(input.eventDate).toISOString(),
      status: "inquiry",
      event_status: "tentative",
      event_type: input.eventType,
      special_requests: input.message || null
    })
    .select()
    .single();
  if (eventError) throw eventError;

  return event;
}
