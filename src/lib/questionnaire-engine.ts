export type QuestionType = "single_select" | "multi_select" | "short_text" | "long_text" | "person_list" | "song" | "time" | "date" | "number" | "phone" | "email";

export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  key: string;
  position: number;
  prompt: string;
  subtext: string | null;
  question_type: QuestionType;
  options: QuestionOption[];
  allow_unsure: boolean;
  required: boolean;
  depends_on_question_key: string | null;
  depends_on_values: string[] | null;
}

export interface Section {
  id: string;
  key: string;
  title: string;
  position: number;
  transition_heading: string | null;
  transition_subheading: string | null;
  questions: Question[];
}

export interface Template {
  id: string;
  event_type: string;
  title: string;
  opening_heading: string;
  opening_body: string;
  opening_cta_label: string;
  sections: Section[];
}

export interface PersonListEntry {
  name: string;
  role: string;
}

export type AnswerValue =
  | { value: string; unsure?: false }
  | { value: string[]; unsure?: false }
  | { value: PersonListEntry[]; unsure?: false }
  | { unsure: true };

export type Answers = Record<string, AnswerValue>;

export interface FlatQuestion {
  section: Section;
  question: Question;
}

function dependencyMet(question: Question, answers: Answers): boolean {
  if (!question.depends_on_question_key) return true;
  const parent = answers[question.depends_on_question_key];
  if (!parent || "unsure" in parent) return false;
  const allowed = question.depends_on_values ?? [];
  if (Array.isArray(parent.value)) {
    return parent.value.some((v) => typeof v === "string" && allowed.includes(v));
  }
  return allowed.includes(parent.value);
}

export function getVisibleQuestions(sections: Section[], answers: Answers): FlatQuestion[] {
  const out: FlatQuestion[] = [];
  for (const section of [...sections].sort((a, b) => a.position - b.position)) {
    for (const question of [...section.questions].sort((a, b) => a.position - b.position)) {
      if (dependencyMet(question, answers)) out.push({ section, question });
    }
  }
  return out;
}

export function isAnswered(answers: Answers, key: string): boolean {
  const a = answers[key];
  if (!a) return false;
  if ("unsure" in a) return true;
  if (Array.isArray(a.value)) return a.value.length > 0;
  return a.value.trim().length > 0;
}

export function computeProgress(flat: FlatQuestion[], answers: Answers): number {
  if (flat.length === 0) return 0;
  const answered = flat.filter((f) => isAnswered(answers, f.question.key)).length;
  return Math.round((answered / flat.length) * 100);
}

export function findFlatIndex(flat: FlatQuestion[], key: string | null): number {
  if (!key) return -1;
  return flat.findIndex((f) => f.question.key === key);
}

export function formatAnswerValue(
  question: { options: QuestionOption[] },
  value: AnswerValue | undefined,
  unsureLabel = "Not decided yet"
): string {
  if (!value) return "Not answered";
  if ("unsure" in value) return unsureLabel;
  const labelFor = (v: string) => question.options.find((o) => o.value === v)?.label ?? v;
  if (Array.isArray(value.value)) {
    if (value.value.length === 0) return "Not answered";
    if (typeof value.value[0] === "object") {
      return (value.value as PersonListEntry[]).map((p) => `${p.name}${p.role ? ` (${p.role})` : ""}`).join(", ");
    }
    return (value.value as string[]).map(labelFor).join(", ");
  }
  return value.value ? labelFor(value.value) : "Not answered";
}

/* ---------------- answer checks (date / number / phone / email) ---------------- */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Digits in a phone number (US numbers may include a leading 1). */
export function phoneDigits(v: string): string {
  return v.replace(/\D/g, "");
}

/** "(262) 555-0123" for 10-digit US numbers; anything else as typed. */
export function formatPhone(v: string): string {
  const d = phoneDigits(v).replace(/^1(?=\d{10}$)/, "");
  return d.length === 10 ? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : v.trim();
}

/**
 * Why an answer isn't usable yet, or null when it's fine. Only checks
 * answers that were given (required-ness is checked separately).
 */
export function answerProblem(question: Pick<Question, "question_type">, value: AnswerValue | undefined): string | null {
  if (!value || "unsure" in value || Array.isArray(value.value)) return null;
  const v = String(value.value).trim();
  if (!v) return null;
  switch (question.question_type) {
    case "date": {
      if (!DATE_RE.test(v) || Number.isNaN(Date.parse(`${v}T12:00:00Z`))) return "Pick a date from the calendar.";
      const y = Number(v.slice(0, 4));
      const now = new Date().getUTCFullYear();
      if (y < now - 1 || y > now + 5) return "Double-check the year.";
      return null;
    }
    case "number":
      return /^\d{1,5}$/.test(v.replace(/[,\s]/g, "")) ? null : "Enter a number, like 150.";
    case "phone": {
      const d = phoneDigits(v);
      return d.length >= 10 && d.length <= 15 ? null : "Enter the full phone number with area code.";
    }
    case "email":
      return EMAIL_RE.test(v) && v.length <= 200 ? null : "Enter a full email address, like name@example.com.";
    default:
      return v.length > 4000 ? "That's a bit long — please shorten it." : null;
  }
}

/** Answer shown back to people: dates written out, phones formatted, times in 12-hour. */
export function displayAnswer(question: Pick<Question, "question_type" | "options">, value: AnswerValue | undefined, unsureLabel?: string): string {
  if (value && !("unsure" in value) && typeof value.value === "string" && value.value.trim()) {
    const v = value.value.trim();
    if (question.question_type === "date" && DATE_RE.test(v)) return new Date(`${v}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
    if (question.question_type === "phone") return formatPhone(v);
    if (question.question_type === "time" && /^\d{2}:\d{2}$/.test(v)) {
      const [h, m] = v.split(":").map(Number);
      return `${h % 12 || 12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
    }
  }
  return formatAnswerValue(question, value, unsureLabel);
}
