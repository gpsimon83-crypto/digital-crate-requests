export type QuestionType = "single_select" | "multi_select" | "short_text" | "long_text" | "person_list" | "song" | "time";

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
