import { createAdminClient } from "@/lib/supabase/admin";

// Events created outside the Scheduler frequently have no ends_at (the
// admin quick-create form only collects a start time). Treating that as a
// zero-length instant would silently under-detect real conflicts, so
// conflict math assumes a full booking day when the end time is unknown —
// matches this business's shortest package (see /admin/services).
const DEFAULT_DURATION_MS = 6 * 60 * 60 * 1000;

export interface EquipmentAssignmentRow {
  id: string;
  event_id: string;
  equipment_id: string;
  quantity: number;
  notes: string | null;
  created_at: string;
  equipment: { id: string; name: string; category: string; quantity_owned: number } | null;
}

export interface ConflictingEvent {
  eventId: string;
  title: string | null;
  startsAt: string | null;
  quantity: number;
}

export interface ConflictCheck {
  quantityOwned: number;
  alreadyAssigned: number;
  requested: number;
  available: number;
  hasConflict: boolean;
  conflictingEvents: ConflictingEvent[];
}

function eventWindow(startsAt: string | null, endsAt: string | null) {
  const start = startsAt ? new Date(startsAt).getTime() : null;
  if (start == null) return null;
  const end = endsAt ? new Date(endsAt).getTime() : start + DEFAULT_DURATION_MS;
  return { start, end };
}

export async function listAssignmentsForEvent(eventId: string): Promise<EquipmentAssignmentRow[]> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("event_equipment_assignments")
    .select("id, event_id, equipment_id, quantity, notes, created_at, equipment(id, name, category, quantity_owned)")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data as unknown as EquipmentAssignmentRow[];
}

/**
 * Checks whether assigning `quantity` units of `equipmentId` to `eventId`
 * would exceed how many the business actually owns, once every other
 * time-overlapping event's existing assignment of the same equipment is
 * accounted for. Doesn't write anything — callers decide whether to block
 * or let staff proceed anyway.
 */
export async function checkConflicts(eventId: string, equipmentId: string, quantity: number): Promise<ConflictCheck> {
  const db = createAdminClient();

  const { data: equipment, error: equipmentError } = await db
    .from("equipment")
    .select("quantity_owned")
    .eq("id", equipmentId)
    .single();
  if (equipmentError) throw equipmentError;

  const { data: targetEvent, error: eventError } = await db
    .from("events")
    .select("starts_at, ends_at")
    .eq("id", eventId)
    .single();
  if (eventError) throw eventError;

  const targetWindow = eventWindow(targetEvent.starts_at, targetEvent.ends_at);

  const { data: otherAssignments, error: assignmentsError } = await db
    .from("event_equipment_assignments")
    .select("quantity, event_id, events!inner(id, title, starts_at, ends_at, status)")
    .eq("equipment_id", equipmentId)
    .neq("event_id", eventId);
  if (assignmentsError) throw assignmentsError;

  const conflictingEvents: ConflictingEvent[] = [];
  let alreadyAssigned = 0;

  for (const row of otherAssignments as unknown as {
    quantity: number;
    event_id: string;
    events: { id: string; title: string | null; starts_at: string | null; ends_at: string | null; status: string };
  }[]) {
    const other = row.events;
    if (!other || other.status === "declined") continue;

    const otherWindow = eventWindow(other.starts_at, other.ends_at);
    if (!targetWindow || !otherWindow) continue;
    const overlaps = targetWindow.start < otherWindow.end && targetWindow.end > otherWindow.start;
    if (!overlaps) continue;

    alreadyAssigned += row.quantity;
    conflictingEvents.push({ eventId: other.id, title: other.title, startsAt: other.starts_at, quantity: row.quantity });
  }

  const quantityOwned = equipment.quantity_owned;
  const available = quantityOwned - alreadyAssigned;

  return {
    quantityOwned,
    alreadyAssigned,
    requested: quantity,
    available,
    hasConflict: quantity > available,
    conflictingEvents
  };
}

export async function assignEquipment(eventId: string, input: { equipmentId: string; quantity: number; notes?: string }) {
  const db = createAdminClient();
  const { data, error } = await db
    .from("event_equipment_assignments")
    .insert({ event_id: eventId, equipment_id: input.equipmentId, quantity: input.quantity, notes: input.notes || null })
    .select("id, event_id, equipment_id, quantity, notes, created_at, equipment(id, name, category, quantity_owned)")
    .single();
  if (error) throw error;
  return data as unknown as EquipmentAssignmentRow;
}

export async function removeAssignment(id: string) {
  const db = createAdminClient();
  const { error } = await db.from("event_equipment_assignments").delete().eq("id", id);
  if (error) throw error;
}
