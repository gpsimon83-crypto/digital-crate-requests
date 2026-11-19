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

export const newToken = () => randomBytes(32).toString("base64url");
export const tokenOk = (t: unknown): t is string => typeof t === "string" && /^[A-Za-z0-9_-]{32,80}$/.test(t);

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

const firstName = (full: string) => full.trim().split(/\s+/)[0] ?? "";
const splitName = (full: string) => {
  const parts = full.trim().split(/\s+/);
  return { first: parts[0] ?? "", last: parts.length > 1 ? parts.slice(1).join(" ") : "" };
};

type EventRow = { id: string; client_id: string | null; starts_at: string | null; timezone: string | null; venue_name: string | null; expected_guests: number | null; couple_display_name: string | null };
type ClientRow = { id: string; first_name: string | null; last_name: string | null; phone: string | null; email: string | null };

/**
 * Wedding basics → the event and client. Only empty fields are filled;
 * anything the CRM already has stays, and a different answer is listed in
 * `differs` for staff to decide.
 */
export async function applyWeddingBasics(db: Db, eventId: string, answers: Answers): Promise<Applied> {
  const applied: Applied = { filled: [], differs: [] };
  const { data: ev } = await db.from("events").select("id, client_id, starts_at, timezone, venue_name, expected_guests, couple_display_name").eq("id", eventId).maybeSingle();
  const event = ev as EventRow | null;
  if (!event) return applied;
  const tz = event.timezone || "America/Chicago";
  const eUpdate: Record<string, unknown> = {};
  const note = (field: string, current: string | null | undefined, answered: string, set: () => void) => {
    if (!answered) return;
    if (current == null || String(current).trim() === "") {
      set();
      applied.filled.push(field);
    } else if (String(current).trim().toLowerCase() !== answered.toLowerCase()) applied.differs.push({ field, current: String(current), answered });
  };

  const date = text(answers, "wedding_date");
  const start = text(answers, "reception_start");
  if (date) {
    const when = zonedInstant(date, /^\d{2}:\d{2}$/.test(start) ? start : "17:00", tz);
    const currentDay = event.starts_at ? new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(event.starts_at)) : null;
    if (!event.starts_at) {
      eUpdate.starts_at = when;
      applied.filled.push(start ? "Date and start time" : "Date");
    } else if (currentDay !== date) applied.differs.push({ field: "Date", current: currentDay ?? "", answered: date });
  }
  note("Venue", event.venue_name, text(answers, "venue"), () => (eUpdate.venue_name = text(answers, "venue").slice(0, 200)));
  const guests = Number(text(answers, "guest_count").replace(/[,\s]/g, ""));
  if (guests > 0) note("Guest count", event.expected_guests == null ? null : String(event.expected_guests), String(guests), () => (eUpdate.expected_guests = guests));
  const p1 = text(answers, "partner_one_name");
  const p2 = text(answers, "partner_two_name");
  if (p1 && p2) note("Couple name", event.couple_display_name, `${firstName(p1)} & ${firstName(p2)}`, () => (eUpdate.couple_display_name = `${firstName(p1)} & ${firstName(p2)}`.slice(0, 120)));
  if (Object.keys(eUpdate).length) {
    const { error } = await db.from("events").update(eUpdate).eq("id", eventId);
    if (error) throw error;
  }

  if (event.client_id) {
    const { data: cl } = await db.from("clients").select("id, first_name, last_name, phone, email").eq("id", event.client_id).maybeSingle();
    const client = cl as ClientRow | null;
    if (client) {
      const cUpdate: Record<string, unknown> = {};
      const n = splitName(p1);
      note("Client first name", client.first_name, n.first, () => (cUpdate.first_name = n.first.slice(0, 100)));
      note("Client last name", client.last_name, n.last, () => (cUpdate.last_name = n.last.slice(0, 100)));
      const phone = text(answers, "partner_one_phone");
      if (phone) {
        const same = client.phone && client.phone.replace(/\D/g, "").slice(-10) === phone.replace(/\D/g, "").slice(-10);
        if (!same) note("Client phone", client.phone, formatPhone(phone), () => (cUpdate.phone = formatPhone(phone)));
      }
      note("Client email", client.email, text(answers, "email").toLowerCase(), () => (cUpdate.email = text(answers, "email").toLowerCase().slice(0, 200)));
      if (Object.keys(cUpdate).length) {
        const { error } = await db.from("clients").update({ ...cUpdate, updated_at: new Date().toISOString() }).eq("id", client.id);
        if (error) throw error;
      }
    }
  }
  return applied;
}
