/**
 * Questionnaires answered through a private link (no login) — for clients
 * we can't email yet. Staff create the link on the event page and copy or
 * text it. Answers save as they go; submitting checks every required answer,
 * locks the answers, and fills the event's and client's EMPTY fields from
 * them (nothing already in the CRM is overwritten; differences are listed
 * for staff instead).
 */
import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { answerProblem, formatPhone, getVisibleQuestions, isAnswered, type Answers, type AnswerValue, type Template } from "@/lib/questionnaire-engine";
import { getTemplateForEventType } from "@/lib/data/questionnaires";

type Db = ReturnType<typeof createAdminClient>;

export const WEDDING_BASICS = "wedding_basics";

export type LinkRow = {
  id: string;
  token: string;
  event_id: string;
  template_id: string;
  answers: Answers;
  current_question_key: string | null;
  completed_at: string | null;
  locked: boolean;
  applied: Applied | null;
  created_at: string;
  updated_at: string;
  opened_at: string | null;
  revoked_at: string | null;
};

export type Applied = {
  /** Fields that were empty and are now filled, e.g. "Venue", "Guest count". */
  filled: string[];
  /** Answers that differ from what the CRM already had (left unchanged). */
  differs: { field: string; current: string; answered: string }[];
};

/** Letters and digits that can't be confused when read aloud or retyped (no 0/o, 1/l/i). */
const SAFE = "abcdefghjkmnpqrstuvwxyz23456789";

/** "Caroline Catlin" → "caroline-catlin" (letters, digits and dashes only, ≤ 30 characters). */
export function nameSlug(name: string | null | undefined): string {
  return (name ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)
    .replace(/-+$/g, "");
}

/**
 * The link's secret: the couple's name plus 10 random characters (about 50
 * bits, far too many to guess), e.g. "caroline-catlin-7k2pxq9mab". The name
 * is only there so the link reads nicely; the random part is what counts.
 */
export function newToken(name?: string | null): string {
  const bytes = randomBytes(10);
  let rand = "";
  for (const b of bytes) rand += SAFE[b % SAFE.length];
  const slug = nameSlug(name);
  return slug ? `${slug}-${rand}` : `wedding-${rand}`;
}
export const tokenOk = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{12,120}$/.test(t) && /[A-Za-z0-9]{10}$/.test(t);

export async function linkByToken(db: Db, token: string): Promise<LinkRow | null> {
  if (!tokenOk(token)) return null;
  const { data, error } = await db.from("questionnaire_links").select("*").eq("token", token).maybeSingle();
  if (error) throw error;
  const row = data as LinkRow | null;
  return row && !row.revoked_at ? row : null;
}

/** The live (not revoked) link for an event and questionnaire, newest first. */
export async function linkForEvent(db: Db, eventId: string, templateId: string): Promise<LinkRow | null> {
  const { data, error } = await db.from("questionnaire_links").select("*").eq("event_id", eventId).eq("template_id", templateId).is("revoked_at", null).order("created_at", { ascending: false }).limit(1);
  if (error) throw error;
  return ((data ?? [])[0] as LinkRow | undefined) ?? null;
}

export async function weddingBasicsTemplate(): Promise<Template | null> {
  return getTemplateForEventType(WEDDING_BASICS);
}

/** Keeps only answers to this questionnaire's questions, trimmed and size-limited. */
export function cleanAnswers(template: Template, input: unknown): Answers {
  const keys = new Set(template.sections.flatMap((s) => s.questions.map((q) => q.key)));
  const out: Answers = {};
  if (!input || typeof input !== "object") return out;
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    if (!keys.has(k) || !v || typeof v !== "object") continue;
    const a = v as { value?: unknown; unsure?: unknown };
    if (a.unsure === true) out[k] = { unsure: true };
    else if (typeof a.value === "string") out[k] = { value: a.value.slice(0, 2000) };
    else if (Array.isArray(a.value)) out[k] = { value: a.value.filter((x) => typeof x === "string").slice(0, 50).map((x: string) => x.slice(0, 300)) } as AnswerValue;
  }
  return out;
}

/** Problems that stop a submission: missing required answers (no "decide later" here) and badly formed ones. */
export function submissionProblems(template: Template, answers: Answers): { key: string; prompt: string; problem: string }[] {
  const out: { key: string; prompt: string; problem: string }[] = [];
  for (const { question } of getVisibleQuestions(template.sections, answers)) {
    const a = answers[question.key];
    if (question.required && (!isAnswered(answers, question.key) || (a && "unsure" in a && !question.allow_unsure))) out.push({ key: question.key, prompt: question.prompt, problem: "This one's required." });
    else {
      const p = answerProblem(question, a);
      if (p) out.push({ key: question.key, prompt: question.prompt, problem: p });
    }
  }
  return out;
}

const text = (a: Answers, k: string) => {
  const v = a[k];
  return v && !("unsure" in v) && typeof v.value === "string" ? v.value.trim() : "";
};
const list = (a: Answers, k: string): string[] => {
  const v = a[k];
  return v && !("unsure" in v) && Array.isArray(v.value) ? v.value.filter((x) => typeof x === "string") : [];
};

/** Wall-clock date + time in a time zone, as an ISO instant (handles daylight saving). */
export function zonedInstant(date: string, hhmm: string, tz: string): string {
  const [y, mo, d] = date.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  let guess = Date.UTC(y, mo - 1, d, h, mi);
  for (let i = 0; i < 3; i++) {
    const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
    const shown = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute);
    const diff = Date.UTC(y, mo - 1, d, h, mi) - shown;
    if (!diff) break;
    guess += diff;
  }
  return new Date(guess).toISOString();
}

const nextDay = (date: string) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};
const HHMM = /^\d{2}:\d{2}$/;
/** Hours from start to end (an end at or before the start is after midnight). */
export function hoursBetween(start: string, end: string): number | null {
  if (!HHMM.test(start) || !HHMM.test(end)) return null;
  const [a, b] = [start, end].map((t) => +t.slice(0, 2) * 60 + +t.slice(3));
  return ((b - a + 1440) % 1440 || 1440) / 60;
}

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";
const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.length > 1 ? parts.slice(1).join(" ") : "" };
};
const localDay = (iso: string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const localTime = (iso: string, tz: string) => new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
const niceWhen = (iso: string, tz: string) => new Date(iso).toLocaleString("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const niceTime = (iso: string, tz: string) => new Date(iso).toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });

type EventRow = { id: string; client_id: string | null; starts_at: string | null; ends_at: string | null; timezone: string | null; venue_name: string | null; expected_guests: number | null; couple_display_name: string | null };
type ClientRow = Record<string, unknown> & { id: string };

/** Columns added by migration 0056; written separately so a missing column never blocks the rest. */
const NEW_CLIENT_COLUMNS = new Set(["partner_first_name", "partner_last_name", "partner_phone", "married_last_name", "contact_methods", "best_days", "best_times"]);

type Field = {
  label: string;
  table: "events" | "clients";
  /** Column → value written when this field is filled. */
  write: Record<string, unknown>;
  /** What the CRM has now, as text (empty = nothing yet). */
  current: string;
  /** Their answer, as text. */
  answered: string;
  same: boolean;
};

/** Every CRM field Wedding Basics can fill, with what's there now and what they answered. */
function weddingFields(event: EventRow, client: ClientRow | null, answers: Answers, labelOf: (key: string, value: string) => string): Field[] {
  const out: Field[] = [];
  const tz = event.timezone || "America/Chicago";
  const add = (f: Omit<Field, "same"> & { same?: boolean }) => {
    if (!f.answered) return;
    out.push({ ...f, same: f.same ?? f.current.trim().toLowerCase() === f.answered.trim().toLowerCase() });
  };
  const str = (v: unknown) => (v == null ? "" : Array.isArray(v) ? v.join(", ") : String(v));

  const date = text(answers, "wedding_date");
  const start = text(answers, "reception_start");
  const end = text(answers, "reception_end");
  if (date) {
    const when = zonedInstant(date, HHMM.test(start) ? start : "17:00", tz);
    add({
      label: HHMM.test(start) ? "Date and start time" : "Date",
      table: "events",
      write: { starts_at: when },
      current: event.starts_at ? niceWhen(event.starts_at, tz) : "",
      answered: niceWhen(when, tz),
      same: !!event.starts_at && localDay(event.starts_at, tz) === date && (!HHMM.test(start) || localTime(event.starts_at, tz) === start)
    });
    if (HHMM.test(end)) {
      const endDay = HHMM.test(start) && end <= start ? nextDay(date) : date;
      const endsAt = zonedInstant(endDay, end, tz);
      add({ label: "End time", table: "events", write: { ends_at: endsAt }, current: event.ends_at ? niceTime(event.ends_at, tz) : "", answered: niceTime(endsAt, tz), same: !!event.ends_at && Math.abs(Date.parse(event.ends_at) - Date.parse(endsAt)) < 60_000 });
    }
  }
  const venue = text(answers, "venue");
  add({ label: "Venue", table: "events", write: { venue_name: venue.slice(0, 200) }, current: str(event.venue_name), answered: venue });
  const guests = Number(text(answers, "guest_count").replace(/[,\s]/g, ""));
  if (guests > 0) add({ label: "Guest count", table: "events", write: { expected_guests: Math.round(guests) }, current: str(event.expected_guests), answered: String(Math.round(guests)) });
  const p1 = text(answers, "partner_one_name");
  const p2 = text(answers, "partner_two_name");
  if (p1 && p2) {
    const couple = `${firstName(p1)} & ${firstName(p2)}`.slice(0, 120);
    add({ label: "Couple name", table: "events", write: { couple_display_name: couple }, current: str(event.couple_display_name), answered: couple });
  }

  if (!client) return out;
  const n1 = splitName(p1);
  add({ label: "Client first name", table: "clients", write: { first_name: n1.first.slice(0, 100) }, current: str(client.first_name), answered: n1.first });
  add({ label: "Client last name", table: "clients", write: { last_name: n1.last.slice(0, 100) }, current: str(client.last_name), answered: n1.last });
  const digits = (v: string) => v.replace(/\D/g, "").slice(-10);
  const phone1 = text(answers, "partner_one_phone");
  if (phone1) add({ label: "Client phone", table: "clients", write: { phone: formatPhone(phone1) }, current: str(client.phone), answered: formatPhone(phone1), same: digits(str(client.phone)) === digits(phone1) });
  const email = text(answers, "email").toLowerCase();
  add({ label: "Client email", table: "clients", write: { email: email.slice(0, 200) }, current: str(client.email), answered: email });

  const n2 = splitName(p2);
  add({ label: "Partner first name", table: "clients", write: { partner_first_name: n2.first.slice(0, 100) }, current: str(client.partner_first_name), answered: n2.first });
  add({ label: "Partner last name", table: "clients", write: { partner_last_name: n2.last.slice(0, 100) }, current: str(client.partner_last_name), answered: n2.last });
  const phone2 = text(answers, "partner_two_phone");
  if (phone2) add({ label: "Partner phone", table: "clients", write: { partner_phone: formatPhone(phone2) }, current: str(client.partner_phone), answered: formatPhone(phone2), same: digits(str(client.partner_phone)) === digits(phone2) });
  const married = text(answers, "married_name");
  add({ label: "Married last name", table: "clients", write: { married_last_name: married.slice(0, 100) }, current: str(client.married_last_name), answered: married });
  for (const [key, col, label] of [["contact_methods", "contact_methods", "Best way to reach"], ["best_days", "best_days", "Best days"], ["best_times", "best_times", "Best times"]] as const) {
    const vals = list(answers, key);
    if (!vals.length) continue;
    const cur = Array.isArray(client[col]) ? (client[col] as string[]) : [];
    add({ label, table: "clients", write: { [col]: vals }, current: cur.map((v) => labelOf(key, v)).join(", "), answered: vals.map((v) => labelOf(key, v)).join(", "), same: cur.length === vals.length && cur.every((v) => vals.includes(v)) });
  }
  return out;
}

/**
 * Wedding basics → the event and client. Empty fields are filled; anything
 * the CRM already has stays, and a different answer is listed in `differs`
 * for staff or the DJ to decide. Pass `overwrite` (field labels) to use
 * their answer for those fields anyway ("Use their answer").
 */
export async function applyWeddingBasics(db: Db, eventId: string, answers: Answers, opts: { overwrite?: string[]; template?: Template | null } = {}): Promise<Applied> {
  const applied: Applied = { filled: [], differs: [] };
  const { data: ev } = await db.from("events").select("id, client_id, starts_at, ends_at, timezone, venue_name, expected_guests, couple_display_name").eq("id", eventId).maybeSingle();
  const event = ev as EventRow | null;
  if (!event) return applied;
  let client: ClientRow | null = null;
  if (event.client_id) {
    const { data: cl } = await db.from("clients").select("*").eq("id", event.client_id).maybeSingle();
    client = (cl as ClientRow | null) ?? null;
  }
  const options = new Map((opts.template?.sections ?? []).flatMap((s) => s.questions.map((q) => [q.key, q.options] as const)));
  const labelOf = (key: string, value: string) => options.get(key)?.find((o) => o.value === value)?.label ?? value;
  const overwrite = new Set(opts.overwrite ?? []);

  const eUpdate: Record<string, unknown> = {};
  const cUpdate: Record<string, unknown> = {};
  const cNew: Record<string, unknown> = {};
  for (const f of weddingFields(event, client, answers, labelOf)) {
    if (f.same) continue;
    if (!f.current.trim() || overwrite.has(f.label)) {
      for (const [col, val] of Object.entries(f.write)) {
        if (f.table === "events") eUpdate[col] = val;
        else (NEW_CLIENT_COLUMNS.has(col) ? cNew : cUpdate)[col] = val;
      }
      applied.filled.push(f.label);
    } else applied.differs.push({ field: f.label, current: f.current, answered: f.answered });
  }
  if (Object.keys(eUpdate).length) {
    const { error } = await db.from("events").update(eUpdate).eq("id", eventId);
    if (error) throw error;
  }
  if (client && Object.keys(cUpdate).length) {
    const { error } = await db.from("clients").update({ ...cUpdate, updated_at: new Date().toISOString() }).eq("id", client.id);
    if (error) throw error;
  }
  if (client && Object.keys(cNew).length) {
    // Before migration 0056 these columns don't exist yet: skip them, don't fail.
    const { error } = await db.from("clients").update(cNew).eq("id", client.id);
    if (error) applied.filled = applied.filled.filter((l) => !weddingFields(event, client, answers, labelOf).some((f) => f.label === l && Object.keys(f.write).some((c) => NEW_CLIENT_COLUMNS.has(c))));
  }
  return applied;
}
