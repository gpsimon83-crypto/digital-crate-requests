/**
 * Night plans: what a venue adds to a date (occasion, drink specials, a DJ request).
 * Shared by the venue save route, the dashboard feed and the admin view.
 * A DJ request is a preference only; DCDJs confirms based on availability.
 */

export type NightPlan = {
  date: string;
  occasion: string | null;
  drink_specials: string | null;
  dj_request_id: string | null;
  dj_request_name: string | null;
  dj_request_note: string | null;
  dj_requested_at: string | null;
  updated_at: string | null;
};

export const PLAN_LIMITS = { occasion: 80, drink_specials: 600, dj_request_name: 80, dj_request_note: 400 } as const;
/** How far ahead a venue can plan. */
export const PLAN_MAX_DAYS_AHEAD = 400;

export const PLAN_COLUMNS = "night_date, occasion, drink_specials, dj_request_id, dj_request_name, dj_request_note, dj_requested_at, updated_at";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Trims, collapses runs of blank lines, strips control characters, caps length; empty → null. */
export function cleanPlanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, max)
    .trim();
  return t || null;
}

function addDays(iso: string, n: number) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function realDate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const d = new Date(`${iso}T12:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === iso;
}

export type PlanInput = {
  date: string;
  occasion: string | null;
  drink_specials: string | null;
  dj_request_id: string | null;
  dj_request_name: string | null;
  dj_request_note: string | null;
};

/** Validates a save from the venue portal. `today` is the venue-local date. */
export function parsePlanInput(body: unknown, today: string): { ok: true; plan: PlanInput } | { ok: false; error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const date = typeof b.date === "string" ? b.date : "";
  if (!realDate(date)) return { ok: false, error: "Pick a date." };
  if (date < today) return { ok: false, error: "That date has already passed." };
  if (date > addDays(today, PLAN_MAX_DAYS_AHEAD)) return { ok: false, error: "Plans can be added up to about a year ahead." };
  const djId = typeof b.dj_request_id === "string" && UUID.test(b.dj_request_id) ? b.dj_request_id.toLowerCase() : null;
  const djName = cleanPlanText(b.dj_request_name, PLAN_LIMITS.dj_request_name);
  return {
    ok: true,
    plan: {
      date,
      occasion: cleanPlanText(b.occasion, PLAN_LIMITS.occasion),
      drink_specials: cleanPlanText(b.drink_specials, PLAN_LIMITS.drink_specials),
      dj_request_id: djId,
      dj_request_name: djName,
      // A note only makes sense with a request, but "any DJ, we need someone" is a valid request too.
      dj_request_note: cleanPlanText(b.dj_request_note, PLAN_LIMITS.dj_request_note)
    }
  };
}

export const isEmptyPlan = (p: Omit<PlanInput, "date">) => !p.occasion && !p.drink_specials && !p.dj_request_id && !p.dj_request_name && !p.dj_request_note;
export const hasDjRequest = (p: Pick<PlanInput, "dj_request_id" | "dj_request_name" | "dj_request_note">) => !!(p.dj_request_id || p.dj_request_name || p.dj_request_note);

export function toNightPlan(r: Record<string, unknown>): NightPlan {
  const s = (v: unknown) => (typeof v === "string" && v ? v : null);
  return {
    date: String(r.night_date ?? "").slice(0, 10),
    occasion: s(r.occasion),
    drink_specials: s(r.drink_specials),
    dj_request_id: s(r.dj_request_id),
    dj_request_name: s(r.dj_request_name),
    dj_request_note: s(r.dj_request_note),
    dj_requested_at: s(r.dj_requested_at),
    updated_at: s(r.updated_at)
  };
}

/** True when the table hasn't been created yet (migration 0048 not run). */
export const missingPlansTable = (err: { code?: string; message?: string } | null | undefined) =>
  !!err && (err.code === "42P01" || err.code === "PGRST205" || /venue_night_plans/.test(err.message ?? ""));
