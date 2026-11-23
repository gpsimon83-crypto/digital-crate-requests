import type { MergeContext } from "@/lib/merge-fields";

/** The fields of a booking that email merge fields use (the DJ booking page and Messages share this). */
export interface BookingForMerge {
  id: string;
  event_code: string;
  starts_at: string | null;
  ends_at: string | null;
  event_type: string | null;
  expected_guests: number | null;
  final_amount: number | null;
  quoted_amount: number | null;
  deposit_amount: number | null;
  djs: { display_name: string } | null;
  venues: { name: string } | null;
  clients: { first_name: string | null; last_name: string | null; company_name: string | null; email: string | null } | null;
}

export function bookingClientName(c: BookingForMerge["clients"]) {
  if (!c) return null;
  return c.company_name || [c.first_name, c.last_name].filter(Boolean).join(" ") || null;
}

const money = (cents: number) => `$${(cents / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

export function bookingMergeContext(event: BookingForMerge, balanceCents: number, origin: string): MergeContext {
  const name = bookingClientName(event.clients);
  return {
    clientFirstName: event.clients?.first_name ?? name ?? undefined,
    clientFullName: name ?? undefined,
    eventType: event.event_type ?? undefined,
    eventDate: event.starts_at ? new Date(event.starts_at).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" }) : undefined,
    eventTime: event.starts_at ? new Date(event.starts_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : undefined,
    eventEndTime: event.ends_at ? new Date(event.ends_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : undefined,
    venueName: event.venues?.name ?? undefined,
    guestCount: event.expected_guests != null ? String(event.expected_guests) : undefined,
    djName: event.djs?.display_name ?? undefined,
    totalAmount: (event.final_amount ?? event.quoted_amount) ? money(Math.round((event.final_amount ?? event.quoted_amount ?? 0) * 100)) : undefined,
    depositAmount: event.deposit_amount != null ? money(Math.round(event.deposit_amount * 100)) : undefined,
    balanceDue: money(balanceCents),
    portalLink: `${origin}/portal/events/${event.id}`,
    schedulerLink: `${origin}/schedule`,
    eventCode: event.event_code
  };
}
