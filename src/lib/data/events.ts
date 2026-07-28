import { createAdminClient } from "@/lib/supabase/admin";

function generateEventCode(title: string) {
  const slug = title
    .split(" ")[0]
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 8) || "EVENT";
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slug}-${suffix}`;
}

export async function listEvents() {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .select("*, djs(display_name, photo_url), venues(name), clients(company_name, first_name, last_name)")
    .order("starts_at", { ascending: true });
  if (error) throw error;

  // One extra query for all succeeded payments rather than N+1 per event —
  // cheap at this scale (a handful of events), and keeps listEvents a
  // single round trip beyond it. Payments is a separate concern from the
  // rest of this list (title, DJ, venue, contract) — if this table isn't
  // there yet (migration not applied) or the query otherwise fails, the
  // whole events list shouldn't go down over it.
  const paidByEvent = new Map<string, number>();
  const { data: payments } = await db.from("payments").select("event_id, amount_cents").eq("status", "succeeded");
  for (const p of payments ?? []) {
    paidByEvent.set(p.event_id, (paidByEvent.get(p.event_id) ?? 0) + p.amount_cents);
  }

  return data.map((event) => ({ ...event, paid_cents: paidByEvent.get(event.id) ?? 0 }));
}

export async function createEvent(input: {
  title: string;
  djId?: string;
  venueId?: string;
  clientId?: string;
  startsAt: string;
  endsAt?: string;
  status?: string;
  eventType?: string;
  serviceType?: string;
  expectedGuests?: number;
  quotedAmount?: number;
}) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .insert({
      event_code: generateEventCode(input.title),
      title: input.title,
      dj_id: input.djId || null,
      venue_id: input.venueId || null,
      client_id: input.clientId || null,
      starts_at: input.startsAt,
      ends_at: input.endsAt || null,
      status: input.status ?? "pending_confirmation",
      event_type: input.eventType || null,
      service_type: input.serviceType || null,
      expected_guests: input.expectedGuests ?? null,
      quoted_amount: input.quotedAmount ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function confirmEvent(eventId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .update({ status: "confirmed" })
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function declineEvent(eventId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .update({ status: "declined" })
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function startEvent(eventId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .update({ status: "live" })
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function closeEvent(eventId: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .update({ status: "ended" })
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * No HelloSign account is configured yet, so this is a lightweight
 * typed-name signature, not a real e-signature service — sending a
 * contract just means linking a document (contract_document_url) and
 * marking it sent; signing is the client's own portal action (see
 * /api/portal/events/[id]/sign), never set from the admin side.
 */
export async function sendEventContract(eventId: string, documentUrl: string) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("events")
    .update({ contract_document_url: documentUrl, contract_sent_at: new Date().toISOString() })
    .eq("id", eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
