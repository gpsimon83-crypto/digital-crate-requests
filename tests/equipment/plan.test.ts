import { describe, it, expect, beforeEach, vi } from "vitest";
import { randomUUID } from "crypto";

/* ---------- tiny in-memory Supabase: filters, embeds, insert/update/upsert, unique plan keys ---------- */
type Row = Record<string, unknown>;
let db: Record<string, Row[]> = {};
function query(table: string) {
  const filters: ((r: Row) => boolean)[] = [];
  let cols = "*";
  let op: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  let payload: Row | Row[] | null = null;
  const embed = (r: Row): Row => {
    const out = { ...r };
    if (cols.includes("equipment(")) out.equipment = (db.equipment ?? []).find((e) => e.id === r.equipment_id) ?? null;
    if (cols.includes("events!inner(")) out.events = (db.events ?? []).find((e) => e.id === r.event_id) ?? null;
    if (cols.includes("venues(")) out.venues = (db.venues ?? []).find((v) => v.id === r.venue_id) ?? null;
    return out;
  };
  const run = (mode: "many" | "single" | "maybe") => {
    const rows = (db[table] ??= []);
    if (op === "insert") {
      const list: Row[] = (Array.isArray(payload) ? payload : [payload!]).map((p) => ({ id: randomUUID(), created_at: new Date().toISOString(), ...p }));
      for (const r of list) {
        if (table === "event_equipment_assignments" && r.plan_item_key && rows.some((x) => x.event_id === r.event_id && x.plan_item_key === r.plan_item_key)) return { data: null, error: { code: "23505", message: "duplicate" } };
      }
      rows.push(...list);
      return { data: mode === "many" ? list.map(embed) : embed(list[0]), error: null };
    }
    if (op === "upsert") {
      const p = payload as Row;
      const hit = rows.find((r) => r.event_id === p.event_id);
      if (hit) Object.assign(hit, p);
      else rows.push({ ...p });
      return { data: null, error: null };
    }
    const hit = rows.filter((r) => filters.every((f) => f(r)));
    if (op === "update") {
      hit.forEach((r) => Object.assign(r, payload));
      return { data: mode === "many" ? hit : (hit[0] ?? null), error: null };
    }
    if (op === "delete") {
      db[table] = rows.filter((r) => !hit.includes(r));
      return { data: null, error: null };
    }
    if (mode === "single") return hit.length === 1 ? { data: embed(hit[0]), error: null } : { data: null, error: { message: "not single" } };
    if (mode === "maybe") return { data: hit[0] ? embed(hit[0]) : null, error: null };
    return { data: hit.map(embed), error: null };
  };
  const q: Record<string, unknown> = {
    select: (c?: string) => ((cols = c ?? "*"), q),
    eq: (k: string, v: unknown) => (filters.push((r) => r[k] === v), q),
    neq: (k: string, v: unknown) => (filters.push((r) => r[k] !== v), q),
    is: (k: string, v: unknown) => (filters.push((r) => (r[k] ?? null) === v), q),
    order: () => q,
    limit: () => q,
    insert: (p: Row | Row[]) => ((op = "insert"), (payload = p), q),
    update: (p: Row) => ((op = "update"), (payload = p), q),
    upsert: (p: Row) => ((op = "upsert"), (payload = p), q),
    delete: () => ((op = "delete"), q),
    maybeSingle: () => Promise.resolve(run("maybe")),
    single: () => Promise.resolve(run("single")),
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => Promise.resolve(run("many")).then(res, rej)
  };
  return q;
}
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: (t: string) => query(t) }) }));
let planning: Record<string, unknown> | null = null;
let basics: Record<string, unknown> | null = null;
vi.mock("@/lib/data/questionnaires", () => ({ getResponse: async () => (planning ? { answers: planning } : null) }));
vi.mock("@/lib/data/questionnaire-links", () => ({ weddingBasicsTemplate: async () => ({ id: "wb" }), linkForEvent: async () => (basics ? { answers: basics } : null) }));

import { buildInputs, missingInputs, overlapFlags, proposeItems, changedInputs, fingerprint, type SetupRule } from "@/lib/equipment-plan";
import { planView, confirmPlan } from "@/lib/data/equipment-plans";

/* The starter rules from migration 0058. */
const c = (field: string, op: string, value: string | number, source = "event") => ({ source, field, op, value }) as SetupRule["conditions"][number];
const RULES: SetupRule[] = [
  { id: "r1", space: "reception", label: "Main speakers, up to 100 guests", conditions: [c("guest_count", "lte", 100)], equipment_id: null, equipment_category: "speakers", quantity: 2, reason: "Two speakers cover up to 100", position: 10, is_active: true },
  { id: "r2", space: "reception", label: "Main speakers, 101–200 guests", conditions: [c("guest_count", "gte", 101), c("guest_count", "lte", 200)], equipment_id: null, equipment_category: "speakers", quantity: 3, reason: "A third speaker", position: 11, is_active: true },
  { id: "r5", space: "reception", label: "Extra speaker for outdoors", conditions: [c("setting", "in", "outdoors,both", "answer")], equipment_id: null, equipment_category: "speakers", quantity: 1, reason: "Outdoors", position: 14, is_active: true },
  { id: "r6", space: "reception", label: "Mixer", conditions: [], equipment_id: null, equipment_category: "mixer", quantity: 1, reason: "Runs the reception", position: 15, is_active: true },
  { id: "r7", space: "ceremony", label: "Ceremony speaker", conditions: [c("guest_count", "lte", 150)], equipment_id: null, equipment_category: "speakers", quantity: 1, reason: "Separate ceremony space", position: 20, is_active: true },
  { id: "r9", space: "ceremony", label: "Ceremony mixer", conditions: [c("ceremony_space", "eq", "different", "answer")], equipment_id: null, equipment_category: "mixer", quantity: 1, reason: "Other location", position: 22, is_active: true },
  { id: "r11", space: "microphones", label: "Mic for the officiant", conditions: [c("microphones", "includes", "officiant", "answer")], equipment_id: null, equipment_category: "microphone", quantity: 1, reason: "Officiant", position: 40, is_active: true },
  { id: "r12", space: "microphones", label: "Mic for toasts", conditions: [c("microphones", "includes", "toasts", "answer")], equipment_id: null, equipment_category: "microphone", quantity: 1, reason: "Toasts", position: 41, is_active: true },
  { id: "r13", space: "microphones", label: "Mic for announcements", conditions: [c("microphones", "includes", "announcements", "answer"), c("microphones", "excludes", "toasts", "answer")], equipment_id: null, equipment_category: "microphone", quantity: 1, reason: "Announcements", position: 42, is_active: true }
];
const ev = (o: Partial<Parameters<typeof buildInputs>[0]> = {}) => ({ expected_guests: 150, event_category: "wedding", starts_at: "2027-09-18T22:00:00Z", ends_at: "2027-09-19T04:00:00Z", timezone: "America/Chicago", venue: "Garden estate", ...o });

describe("equipment recommendations: inputs and rules", () => {
  it("uses the planning questionnaire first, then Wedding Basics, and only asks what's missing", () => {
    const fromBasics = buildInputs(ev(), null, { indoor_outdoor: { value: "indoors" }, coverage: { value: ["ceremony", "reception"] }, ceremony_location: { value: "same_venue" } });
    expect(fromBasics).toMatchObject({ setting: "indoors", ceremonySpace: "same_venue", cocktailSpace: "none", microphones: ["officiant", "toasts"] });
    expect(fromBasics.sources).toMatchObject({ setting: "wedding basics", microphones: "assumed" });
    // The planning questionnaire wins over Wedding Basics.
    const both = buildInputs(ev(), { setup_setting: { value: "both" }, setup_microphones: { value: ["toasts"] } }, { indoor_outdoor: { value: "indoors" } });
    expect(both).toMatchObject({ setting: "both", microphones: ["toasts"] });
    expect(both.sources.setting).toBe("questionnaire");
    // Missing: only what matters for this event.
    expect(missingInputs(buildInputs(ev({ expected_guests: null }), null, null)).map((m) => m.field)).toEqual(["guests", "setting", "ceremonySpace", "cocktailSpace", "microphones"]);
    expect(missingInputs(buildInputs(ev({ event_category: "corporate" }), { setup_setting: { value: "indoors" }, setup_microphones: { value: ["none"] } }, null))).toEqual([]);
  });

  it("150-guest indoor reception with a separate ceremony: reception audio, ceremony audio, mics for ceremony and toasts", () => {
    const i = buildInputs(ev(), { setup_setting: { value: "indoors" }, setup_ceremony_space: { value: "same_venue" }, setup_cocktail_space: { value: "same_room" }, setup_microphones: { value: ["officiant", "toasts"] } }, null);
    const items = proposeItems(RULES, i);
    expect(items.map((x) => [x.space, x.equipmentCategory, x.quantity])).toEqual([
      ["reception", "speakers", 3],
      ["reception", "mixer", 1],
      ["ceremony", "speakers", 1],
      ["microphones", "microphone", 1],
      ["microphones", "microphone", 1]
    ]);
    expect(items[0].reason).toBe("A third speaker");
    // Outdoors adds a speaker; a ceremony at another location adds a mixer; announcements don't double up with toasts.
    const out = proposeItems(RULES, buildInputs(ev({ expected_guests: 80 }), { setup_setting: { value: "outdoors" }, setup_ceremony_space: { value: "different" }, setup_microphones: { value: ["toasts", "announcements"] } }, null));
    expect(out.map((x) => x.ruleId)).toEqual(["r1", "r5", "r6", "r7", "r9", "r12"]);
  });

  it("flags separate spaces whose times overlap, only when the times are known", () => {
    const base = { setup_ceremony_space: { value: "same_venue" } };
    // Reception 5 PM – 11 PM Central; ceremony at 6 PM in another space overlaps it.
    expect(overlapFlags(buildInputs(ev(), { ...base, setup_ceremony_time: { value: "18:00" } }, null))[0]).toMatch(/overlap/);
    // Ceremony 4 PM, separate cocktail hour, reception 5 PM: a quick turnover.
    expect(overlapFlags(buildInputs(ev(), { ...base, setup_ceremony_time: { value: "16:00" }, setup_cocktail_space: { value: "separate" } }, null))[0]).toMatch(/turnover/);
    expect(overlapFlags(buildInputs(ev(), base, null))).toEqual([]);
  });

  it("notices when guest count, venue, timing or setup change", () => {
    const a = buildInputs(ev(), { setup_setting: { value: "indoors" } }, null);
    const b = buildInputs(ev({ expected_guests: 180 }), { setup_setting: { value: "outdoors" } }, null);
    expect(fingerprint(a)).not.toBe(fingerprint(b));
    expect(changedInputs(a, b)).toEqual(["Guests 150 → 180", "Setup answers changed"]);
    expect(fingerprint(a)).toBe(fingerprint(buildInputs(ev(), { setup_setting: { value: "indoors" } }, null)));
  });
});

describe("equipment recommendations: availability, approval and no duplicates", () => {
  const EV = "eeeeeeee-0000-4000-8000-000000000001";
  const OTHER = "eeeeeeee-0000-4000-8000-000000000002";
  const SPK_A = "aaaaaaaa-0000-4000-8000-000000000001";
  const SPK_B = "aaaaaaaa-0000-4000-8000-000000000002";
  const MIX = "aaaaaaaa-0000-4000-8000-000000000003";
  const MIC = "aaaaaaaa-0000-4000-8000-000000000004";
  const LIGHT = "aaaaaaaa-0000-4000-8000-000000000005";
  beforeEach(() => {
    planning = { setup_setting: { value: "indoors" }, setup_ceremony_space: { value: "same_venue" }, setup_cocktail_space: { value: "same_room" }, setup_microphones: { value: ["officiant", "toasts"] } };
    basics = null;
    db = {
      events: [
        { id: EV, expected_guests: 150, event_category: "wedding", starts_at: "2027-09-18T22:00:00Z", ends_at: "2027-09-19T04:00:00Z", timezone: "America/Chicago", venue_name: "Garden estate", venue_id: null, status: "confirmed" },
        { id: OTHER, title: "Another wedding", expected_guests: 90, event_category: "wedding", starts_at: "2027-09-18T23:00:00Z", ends_at: "2027-09-19T03:00:00Z", status: "confirmed" }
      ],
      equipment: [
        { id: SPK_A, name: "QSC K12", category: "speakers", quantity_owned: 4, status: "available", deleted_at: null },
        { id: SPK_B, name: "JBL EON", category: "speakers", quantity_owned: 2, status: "available", deleted_at: null },
        { id: MIX, name: "Rane Seventy", category: "mixer", quantity_owned: 1, status: "available", deleted_at: null },
        { id: MIC, name: "Shure SLX", category: "microphone", quantity_owned: 2, status: "available", deleted_at: null },
        { id: LIGHT, name: "Uplight", category: "lights", quantity_owned: 8, status: "available", deleted_at: null }
      ],
      // The other wedding the same night already has 3 of the 4 QSCs.
      event_equipment_assignments: [
        { id: randomUUID(), event_id: OTHER, equipment_id: SPK_A, quantity: 3, notes: null, plan_item_key: null, created_at: "2026-01-01" },
        // A manual assignment on this event: never touched by the plan.
        { id: "manual-1", event_id: EV, equipment_id: LIGHT, quantity: 4, notes: "Uplights (manual)", plan_item_key: null, created_at: "2026-01-02" }
      ],
      equipment_setup_rules: RULES.map((r) => ({ ...r })),
      event_equipment_plans: []
    };
  });

  it("proposes gear with availability for the date, and assigns nothing until approved", async () => {
    const v = (await planView(EV))!;
    expect(v.status).toBe("proposed");
    expect(v.usedInputs).toEqual(["150 guests", "indoors", "ceremony in a separate space", "mics: officiant, toasts"]);
    const rec = v.lines.find((l) => l.key === "reception:r2")!;
    // Only 1 QSC free that night, so the JBLs (2 free) are picked, and they're 1 short of 3.
    expect(rec).toMatchObject({ equipmentId: SPK_B, quantity: 3, available: 2 });
    const cer = v.lines.find((l) => l.key === "ceremony:r7")!;
    // The reception already takes both JBLs: the ceremony's speaker shows none left on that gear.
    expect(cer.available).toBe(0);
    expect(v.confirmed.map((a) => a.id)).toEqual(["manual-1"]);
    expect(db.event_equipment_assignments.filter((a) => a.event_id === EV)).toHaveLength(1);
  });

  it("missing answers show what to ask; no rule for a space keeps manual assigning available", async () => {
    planning = null;
    db.events[0].expected_guests = null;
    db.equipment_setup_rules = db.equipment_setup_rules.filter((r) => r.space !== "microphones");
    const v = (await planView(EV))!;
    expect(v.status).toBe("incomplete");
    expect(v.missing.map((m) => m.field)).toEqual(["guests", "setting", "ceremonySpace", "cocktailSpace", "microphones"]);
    expect(v.uncovered).toEqual(["Microphones"]);
  });

  it("confirm checks availability, assigns with plan keys, and confirming twice doesn't duplicate", async () => {
    const items = [
      { key: "reception:r2", space: "reception" as const, label: "Main speakers", equipmentId: SPK_B, quantity: 3 },
      { key: "reception:r6", space: "reception" as const, label: "Mixer", equipmentId: MIX, quantity: 1 },
      { key: "microphones:r11", space: "microphones" as const, label: "Officiant mic", equipmentId: MIC, quantity: 1 }
    ];
    // 3 JBLs requested, 2 owned: blocked unless forced.
    const blocked = await confirmPlan(EV, items, { userId: "u1", force: false });
    expect(blocked.ok).toBe(false);
    expect("conflicts" in blocked && blocked.conflicts.map((c) => [c.equipmentId, c.requested, c.available])).toEqual([[SPK_B, 3, 2]]);
    expect(db.event_equipment_assignments.filter((a) => a.event_id === EV)).toHaveLength(1);

    // Staff lower it to 2 and confirm.
    items[0].quantity = 2;
    const first = await confirmPlan(EV, items, { userId: "u1", force: false });
    expect(first).toMatchObject({ ok: true, added: 3, updated: 0 });
    const mine = () => db.event_equipment_assignments.filter((a) => a.event_id === EV);
    expect(mine()).toHaveLength(4);
    // Confirm the same thing again: nothing new.
    expect(await confirmPlan(EV, items, { userId: "u1", force: false })).toMatchObject({ ok: true, added: 0, updated: 0 });
    expect(mine()).toHaveLength(4);
    // Change a quantity: the same assignment updates.
    items[2].quantity = 2;
    expect(await confirmPlan(EV, items, { userId: "u1", force: false })).toMatchObject({ ok: true, added: 0, updated: 1 });
    expect(mine().find((a) => a.plan_item_key === "microphones:r11")!.quantity).toBe(2);
    // The manual assignment is untouched.
    expect(mine().find((a) => a.id === "manual-1")).toMatchObject({ quantity: 4, plan_item_key: null });

    const v = (await planView(EV))!;
    expect(v.status).toBe("confirmed");
  });

  it("two confirms at the same moment still make one assignment per line", async () => {
    const items = [{ key: "reception:r6", space: "reception" as const, label: "Mixer", equipmentId: MIX, quantity: 1 }];
    await Promise.all([confirmPlan(EV, items, { userId: "u1", force: false }), confirmPlan(EV, items, { userId: "u2", force: false })]);
    expect(db.event_equipment_assignments.filter((a) => a.plan_item_key === "reception:r6")).toHaveLength(1);
  });

  it("when guests or setup change after approval it flags a review and keeps the assignments", async () => {
    await confirmPlan(EV, [{ key: "reception:r6", space: "reception", label: "Mixer", equipmentId: MIX, quantity: 1 }], { userId: "u1", force: false });
    db.events[0].expected_guests = 180;
    planning = { ...planning!, setup_setting: { value: "outdoors" } };
    const v = (await planView(EV))!;
    expect(v.status).toBe("needs_review");
    expect(v.plan!.changes).toEqual(["Guests 150 → 180", "Setup answers changed"]);
    expect(v.confirmed.map((a) => a.planItemKey)).toEqual([null, "reception:r6"]);
    // The new proposal reflects the change (outdoors adds a speaker).
    expect(v.lines.some((l) => l.key === "reception:r5")).toBe(true);
  });
});
