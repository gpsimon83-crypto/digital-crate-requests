import { createAdminClient } from "@/lib/supabase/admin";

export interface FieldChange {
  field: string;
  label: string;
  oldValue: string;
  newValue: string;
}

export interface ChangeOrderRow {
  id: string;
  event_id: string;
  contract_id: string | null;
  changes: FieldChange[];
  client_acknowledged_at: string | null;
  client_acknowledged_by: string | null;
  dj_acknowledged_at: string | null;
  created_at: string;
}

const TRACKED_FIELDS: { key: string; label: string; format?: (v: unknown) => string }[] = [
  { key: "starts_at", label: "Start time", format: (v) => (v ? new Date(v as string).toLocaleString() : "—") },
  { key: "ends_at", label: "End time", format: (v) => (v ? new Date(v as string).toLocaleString() : "—") },
  { key: "venue_name", label: "Venue" },
  { key: "quoted_amount", label: "Quoted amount", format: (v) => (v != null ? `$${Number(v).toFixed(2)}` : "—") },
  { key: "final_amount", label: "Final amount", format: (v) => (v != null ? `$${Number(v).toFixed(2)}` : "—") },
  { key: "package_selection_id", label: "Package selection" }
];

/** Compares only the tracked fields between a before/after row and returns a human-readable diff. */
export function diffTrackedFields(before: Record<string, unknown>, after: Record<string, unknown>): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const { key, label, format } of TRACKED_FIELDS) {
    if (!(key in after) || after[key] === before[key]) continue;
    const fmt = format ?? ((v: unknown) => (v == null ? "—" : String(v)));
    changes.push({ field: key, label, oldValue: fmt(before[key]), newValue: fmt(after[key]) });
  }
  return changes;
}

export async function listChangeOrdersForEvent(eventId: string): Promise<ChangeOrderRow[]> {
  const db = createAdminClient();
  const { data, error } = await db.from("contract_change_orders").select("*").eq("event_id", eventId).order("created_at", { ascending: false });
  if (error) throw error;
  return data as ChangeOrderRow[];
}

/**
 * Only creates a change order when this event actually has a signed
 * contract on file — editing these same fields before anything is signed
 * is just normal pre-contract planning, nothing to acknowledge yet.
 */
export async function recordChangeOrderIfSigned(eventId: string, changes: FieldChange[]): Promise<void> {
  if (changes.length === 0) return;
  const db = createAdminClient();
  const { data: contract } = await db
    .from("contracts")
    .select("id")
    .eq("event_id", eventId)
    .eq("status", "signed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!contract) return;

  const { error } = await db.from("contract_change_orders").insert({ event_id: eventId, contract_id: contract.id, changes });
  if (error) throw error;
}

export async function acknowledgeChangeOrderAsClient(id: string, eventId: string, clientId: string, name: string): Promise<ChangeOrderRow | null> {
  const db = createAdminClient();
  const { data: event } = await db.from("events").select("id").eq("id", eventId).eq("client_id", clientId).maybeSingle();
  if (!event) return null;

  const { data, error } = await db
    .from("contract_change_orders")
    .update({ client_acknowledged_at: new Date().toISOString(), client_acknowledged_by: name })
    .eq("id", id)
    .eq("event_id", eventId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as ChangeOrderRow | null;
}

export async function acknowledgeChangeOrderAsDj(id: string, eventId: string, djId: string): Promise<ChangeOrderRow | null> {
  const db = createAdminClient();
  const { data: event } = await db.from("events").select("id").eq("id", eventId).eq("dj_id", djId).maybeSingle();
  if (!event) return null;

  const { data, error } = await db
    .from("contract_change_orders")
    .update({ dj_acknowledged_at: new Date().toISOString() })
    .eq("id", id)
    .eq("event_id", eventId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as ChangeOrderRow | null;
}
