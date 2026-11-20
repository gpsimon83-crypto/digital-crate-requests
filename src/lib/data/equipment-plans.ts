/**
 * Equipment recommendations for an event — the database part. Builds the
 * proposal from the setup rules and inventory, checks availability against
 * other bookings, and turns an approved proposal into assignments through
 * the existing assignment flow (conflict check, then assign). Nothing is
 * assigned until staff confirm, and confirming again updates the same
 * assignments instead of adding new ones.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getResponse } from "@/lib/data/questionnaires";
import { linkForEvent, weddingBasicsTemplate } from "@/lib/data/questionnaire-links";
import { checkConflicts } from "@/lib/data/equipment-assignments";
import { buildInputs, changedInputs, fingerprint, inputSummary, missingInputs, overlapFlags, proposeItems, SPACE_LABEL, type SetupInputs, type SetupRule, type Space } from "@/lib/equipment-plan";
import type { Answers } from "@/lib/questionnaire-engine";

type Db = ReturnType<typeof createAdminClient>;
export type InventoryItem = { id: string; name: string; category: string; quantity_owned: number; status: string };

export type PlanLine = {
  key: string;
  space: Space;
  spaceLabel: string;
  label: string;
  reason: string;
  equipmentId: string | null;
  equipmentName: string | null;
  category: string | null;
  quantity: number;
  /** Units free for this event's time after other bookings (null when no gear matched). */
  available: number | null;
  conflictingEvents: { eventId: string; title: string | null; startsAt: string | null; quantity: number }[];
  /** No inventory item matches this rule's item or category. */
  noGear: boolean;
};

export type ConfirmedAssignment = { id: string; equipmentId: string; name: string; category: string; quantity: number; planItemKey: string | null; notes: string | null };

export type PlanView = {
  ready: boolean;
  inputs: SetupInputs;
  usedInputs: string[];
  missing: { field: string; label: string; ask: string }[];
  flags: string[];
  lines: PlanLine[];
  /** Spaces this event has but no active rule covers. */
  uncovered: string[];
  confirmed: ConfirmedAssignment[];
  plan: { confirmedAt: string | null; changes: string[]; needsReview: boolean } | null;
  status: "no_rules" | "incomplete" | "proposed" | "confirmed" | "needs_review";
};

export async function loadRules(db: Db): Promise<SetupRule[] | null> {
  const { data, error } = await db.from("equipment_setup_rules").select("*").order("position");
  if (error) return null; // before migration 0058
  return (data ?? []) as SetupRule[];
}

async function loadInventory(db: Db): Promise<InventoryItem[]> {
  const { data, error } = await db.from("equipment").select("id, name, category, quantity_owned, status").is("deleted_at", null);
  if (error) throw error;
  return ((data ?? []) as InventoryItem[]).filter((e) => e.status !== "retired");
}

async function loadAssignments(db: Db, eventId: string): Promise<ConfirmedAssignment[]> {
  // plan_item_key arrives with migration 0058; read without it before then.
  let res: { data: unknown[] | null; error: unknown } = await db.from("event_equipment_assignments").select("id, equipment_id, quantity, notes, plan_item_key, equipment(name, category)").eq("event_id", eventId).order("created_at");
  if (res.error) res = await db.from("event_equipment_assignments").select("id, equipment_id, quantity, notes, equipment(name, category)").eq("event_id", eventId).order("created_at");
  if (res.error) throw res.error;
  return ((res.data ?? []) as unknown as { id: string; equipment_id: string; quantity: number; notes: string | null; plan_item_key?: string | null; equipment: { name: string; category: string } | null }[]).map((a) => ({
    id: a.id,
    equipmentId: a.equipment_id,
    name: a.equipment?.name ?? "Equipment",
    category: a.equipment?.category ?? "",
    quantity: a.quantity,
    planItemKey: a.plan_item_key ?? null,
    notes: a.notes
  }));
}

async function loadInputs(db: Db, eventId: string): Promise<SetupInputs | null> {
  const { data: ev } = await db.from("events").select("expected_guests, event_category, starts_at, ends_at, timezone, venue_name, venues(name)").eq("id", eventId).maybeSingle();
  if (!ev) return null;
  const e = ev as unknown as { expected_guests: number | null; event_category: string | null; starts_at: string | null; ends_at: string | null; timezone: string | null; venue_name: string | null; venues: { name: string } | null };
  const planning = ((await getResponse(eventId).catch(() => null))?.answers as Answers | undefined) ?? null;
  let basics: Answers | null = null;
  try {
    const t = await weddingBasicsTemplate();
    if (t) basics = (await linkForEvent(db, eventId, t.id))?.answers ?? null;
  } catch {
    // no Wedding Basics yet
  }
  return buildInputs({ ...e, venue: e.venues?.name ?? e.venue_name }, planning, basics);
}

/** The gear for one rule: its item, or the item in its category with the most units free. */
async function resolveGear(eventId: string, inventory: InventoryItem[], equipmentId: string | null, category: string | null, quantity: number) {
  const candidates = equipmentId ? inventory.filter((e) => e.id === equipmentId) : inventory.filter((e) => e.category.toLowerCase() === (category ?? "").toLowerCase());
  let best: { item: InventoryItem; available: number; conflicting: PlanLine["conflictingEvents"] } | null = null;
  for (const item of candidates.slice(0, 8)) {
    const c = await checkConflicts(eventId, item.id, quantity);
    if (!best || c.available > best.available) best = { item, available: c.available, conflicting: c.conflictingEvents };
  }
  return best;
}

export async function planView(eventId: string): Promise<PlanView | null> {
  const db = createAdminClient();
  const inputs = await loadInputs(db, eventId);
  if (!inputs) return null;
  const rules = await loadRules(db);
  const confirmed = await loadAssignments(db, eventId);
  const base = { inputs, usedInputs: inputSummary(inputs), missing: missingInputs(inputs), flags: overlapFlags(inputs), confirmed };
  if (!rules) return { ready: false, ...base, lines: [], uncovered: [], plan: null, status: "no_rules" };

  const inventory = await loadInventory(db);
  const proposed = proposeItems(rules, inputs);
  const lines: PlanLine[] = [];
  // Several lines can use the same gear (e.g. speakers for reception and ceremony): count them together.
  const requestedBy = new Map<string, number>();
  for (const p of proposed) {
    const gear = await resolveGear(eventId, inventory, p.equipmentId, p.equipmentCategory, p.quantity);
    const prior = gear ? (requestedBy.get(gear.item.id) ?? 0) : 0;
    if (gear) requestedBy.set(gear.item.id, prior + p.quantity);
    lines.push({
      key: p.key,
      space: p.space,
      spaceLabel: SPACE_LABEL[p.space],
      label: p.label,
      reason: p.reason,
      equipmentId: gear?.item.id ?? null,
      equipmentName: gear?.item.name ?? null,
      category: gear?.item.category ?? p.equipmentCategory,
      quantity: p.quantity,
      available: gear ? Math.max(0, gear.available - prior) : null,
      conflictingEvents: gear?.conflicting ?? [],
      noGear: !gear
    });
  }
  const covered = new Set(lines.map((l) => l.space));
  const spaces: Space[] = ["reception"];
  if (inputs.ceremonySpace === "same_venue" || inputs.ceremonySpace === "different") spaces.push("ceremony");
  if (inputs.cocktailSpace === "separate") spaces.push("cocktail");
  if (inputs.microphones.length) spaces.push("microphones");
  const uncovered = spaces.filter((s) => !covered.has(s)).map((s) => SPACE_LABEL[s]);

  const { data: planRow } = await db.from("event_equipment_plans").select("inputs, fingerprint, confirmed_at").eq("event_id", eventId).maybeSingle();
  const pr = planRow as { inputs: Partial<SetupInputs>; fingerprint: string | null; confirmed_at: string | null } | null;
  const needsReview = !!pr?.confirmed_at && pr.fingerprint !== fingerprint(inputs);
  const plan = pr ? { confirmedAt: pr.confirmed_at, changes: needsReview ? changedInputs(pr.inputs, inputs) : [], needsReview } : null;
  const status: PlanView["status"] = needsReview ? "needs_review" : pr?.confirmed_at ? "confirmed" : base.missing.some((m) => m.field !== "microphones") || !lines.length ? "incomplete" : "proposed";
  return { ready: true, ...base, lines, uncovered, plan, status };
}

export type ConfirmItem = { key: string; space: Space; label: string; equipmentId: string; quantity: number; reason?: string };

const KEY = /^(reception|ceremony|cocktail|microphones):[A-Za-z0-9_-]{1,64}$/;

/**
 * Staff approval: each line becomes (or updates) an assignment keyed by the
 * line, after the same conflict check as a manual assignment. Lines that
 * would overbook return as conflicts unless `force`. Manual assignments and
 * lines staff removed from the proposal are left as they are.
 */
export async function confirmPlan(eventId: string, items: ConfirmItem[], opts: { userId: string | null; force: boolean }) {
  const db = createAdminClient();
  const clean = items.filter((i) => KEY.test(i.key) && typeof i.equipmentId === "string" && Number.isInteger(i.quantity) && i.quantity >= 1 && i.quantity <= 50);
  if (!clean.length) return { ok: false as const, error: "Nothing to confirm." };
  const existing = await loadAssignments(db, eventId);
  const byKey = new Map(existing.filter((a) => a.planItemKey).map((a) => [a.planItemKey!, a]));

  // Conflict check per gear, with every line using it counted together.
  const totals = new Map<string, number>();
  for (const i of clean) totals.set(i.equipmentId, (totals.get(i.equipmentId) ?? 0) + i.quantity);
  const conflicts: { equipmentId: string; requested: number; available: number; conflictingEvents: PlanLine["conflictingEvents"] }[] = [];
  for (const [equipmentId, qty] of totals) {
    const c = await checkConflicts(eventId, equipmentId, qty);
    if (c.hasConflict) conflicts.push({ equipmentId, requested: qty, available: c.available, conflictingEvents: c.conflictingEvents });
  }
  if (conflicts.length && !opts.force) return { ok: false as const, conflicts };

  let added = 0;
  let updated = 0;
  for (const i of clean) {
    const note = `${SPACE_LABEL[i.space]}: ${i.label}`.slice(0, 200);
    const prior = byKey.get(i.key);
    if (prior) {
      if (prior.quantity !== i.quantity || prior.equipmentId !== i.equipmentId) {
        const { error } = await db.from("event_equipment_assignments").update({ quantity: i.quantity, equipment_id: i.equipmentId, notes: note }).eq("id", prior.id);
        if (error) throw error;
        updated++;
      }
      continue;
    }
    const { error } = await db.from("event_equipment_assignments").insert({ event_id: eventId, equipment_id: i.equipmentId, quantity: i.quantity, notes: note, plan_item_key: i.key });
    if (error) {
      // Confirmed twice at once: the other request already made it — update instead of duplicating.
      if ((error as { code?: string }).code === "23505") {
        await db.from("event_equipment_assignments").update({ quantity: i.quantity, equipment_id: i.equipmentId, notes: note }).eq("event_id", eventId).eq("plan_item_key", i.key);
        updated++;
        continue;
      }
      throw error;
    }
    added++;
  }

  const inputs = await loadInputs(db, eventId);
  const now = new Date().toISOString();
  const { error } = await db
    .from("event_equipment_plans")
    .upsert({ event_id: eventId, items: clean, inputs, fingerprint: inputs ? fingerprint(inputs) : null, confirmed_at: now, confirmed_by: opts.userId, updated_at: now }, { onConflict: "event_id" });
  if (error) throw error;
  return { ok: true as const, added, updated, overbooked: conflicts.length };
}
