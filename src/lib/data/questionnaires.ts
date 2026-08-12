import { createAdminClient } from "@/lib/supabase/admin";
import type { Template, Section, Answers, QuestionType, QuestionOption } from "@/lib/questionnaire-engine";

export interface QuestionnaireResponseRow {
  id: string;
  event_id: string;
  template_id: string;
  answers: Answers;
  current_question_key: string | null;
  completed_at: string | null;
}

// Raw row shapes (snake_case DB columns) — kept separate from the
// engine's Template/Section/Question types, which the admin UI also
// consumes directly (it needs is_active and the raw ids, which the
// client-facing engine type intentionally omits).
export interface TemplateRow {
  id: string;
  event_type: string;
  title: string;
  opening_heading: string;
  opening_body: string;
  opening_cta_label: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SectionRow {
  id: string;
  template_id: string;
  key: string;
  title: string;
  position: number;
  transition_heading: string | null;
  transition_subheading: string | null;
}

export interface QuestionRow {
  id: string;
  section_id: string;
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

function buildTemplate(template: TemplateRow, sections: SectionRow[], questions: QuestionRow[]): Template {
  const sectionsOut: Section[] = sections.map((s) => ({
    id: s.id,
    key: s.key,
    title: s.title,
    position: s.position,
    transition_heading: s.transition_heading,
    transition_subheading: s.transition_subheading,
    questions: questions
      .filter((q) => q.section_id === s.id)
      .map((q) => ({
        id: q.id,
        key: q.key,
        position: q.position,
        prompt: q.prompt,
        subtext: q.subtext,
        question_type: q.question_type,
        options: q.options ?? [],
        allow_unsure: q.allow_unsure,
        required: q.required,
        depends_on_question_key: q.depends_on_question_key,
        depends_on_values: q.depends_on_values
      }))
  }));

  return {
    id: template.id,
    event_type: template.event_type,
    title: template.title,
    opening_heading: template.opening_heading,
    opening_body: template.opening_body,
    opening_cta_label: template.opening_cta_label,
    sections: sectionsOut
  };
}

async function loadSectionsAndQuestions(templateId: string) {
  const db = createAdminClient();
  const { data: sections, error: sectionsError } = await db
    .from("questionnaire_sections")
    .select("*")
    .eq("template_id", templateId)
    .order("position");
  if (sectionsError) throw sectionsError;

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: questions, error: questionsError } =
    sectionIds.length > 0
      ? await db.from("questionnaire_questions").select("*").in("section_id", sectionIds).order("position")
      : { data: [] as QuestionRow[], error: null };
  if (questionsError) throw questionsError;

  return { sections: (sections ?? []) as SectionRow[], questions: (questions ?? []) as QuestionRow[] };
}

export async function getTemplateForEventType(eventType: string): Promise<Template | null> {
  const db = createAdminClient();
  const { data: template, error } = await db
    .from("questionnaire_templates")
    .select("*")
    .eq("event_type", eventType)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!template) return null;

  const { sections, questions } = await loadSectionsAndQuestions(template.id);
  return buildTemplate(template as TemplateRow, sections, questions);
}

export async function getResponse(eventId: string): Promise<QuestionnaireResponseRow | null> {
  const db = createAdminClient();
  const { data, error } = await db.from("questionnaire_responses").select("*").eq("event_id", eventId).maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertResponse(
  eventId: string,
  templateId: string,
  updates: { answers?: Answers; currentQuestionKey?: string | null }
): Promise<QuestionnaireResponseRow> {
  const db = createAdminClient();
  const existing = await getResponse(eventId);

  if (!existing) {
    const { data, error } = await db
      .from("questionnaire_responses")
      .insert({
        event_id: eventId,
        template_id: templateId,
        answers: updates.answers ?? {},
        current_question_key: updates.currentQuestionKey ?? null
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  const mergedAnswers = updates.answers ? { ...existing.answers, ...updates.answers } : existing.answers;
  const { data, error } = await db
    .from("questionnaire_responses")
    .update({
      answers: mergedAnswers,
      ...(updates.currentQuestionKey !== undefined ? { current_question_key: updates.currentQuestionKey } : {}),
      updated_at: new Date().toISOString()
    })
    .eq("event_id", eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markResponseCompleted(eventId: string): Promise<QuestionnaireResponseRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("questionnaire_responses")
    .update({ completed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("event_id", eventId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── Admin builder CRUD ──────────────────────────────────────────────

export interface TemplateSummary extends TemplateRow {
  section_count: number;
  question_count: number;
}

export async function listTemplatesForAdmin(): Promise<TemplateSummary[]> {
  const db = createAdminClient();
  const { data: templates, error } = await db.from("questionnaire_templates").select("*").order("event_type");
  if (error) throw error;

  const { data: sections, error: sectionsError } = await db.from("questionnaire_sections").select("id, template_id");
  if (sectionsError) throw sectionsError;

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: questions, error: questionsError } =
    sectionIds.length > 0 ? await db.from("questionnaire_questions").select("id, section_id").in("section_id", sectionIds) : { data: [], error: null };
  if (questionsError) throw questionsError;

  return (templates ?? []).map((t) => {
    const templateSectionIds = new Set((sections ?? []).filter((s) => s.template_id === t.id).map((s) => s.id));
    const questionCount = (questions ?? []).filter((q) => templateSectionIds.has(q.section_id)).length;
    return { ...(t as TemplateRow), section_count: templateSectionIds.size, question_count: questionCount };
  });
}

export async function getTemplateByIdForAdmin(templateId: string): Promise<{ template: TemplateRow; sections: SectionRow[]; questions: QuestionRow[] } | null> {
  const db = createAdminClient();
  const { data: template, error } = await db.from("questionnaire_templates").select("*").eq("id", templateId).maybeSingle();
  if (error) throw error;
  if (!template) return null;

  const { sections, questions } = await loadSectionsAndQuestions(templateId);
  return { template: template as TemplateRow, sections, questions };
}

export async function updateTemplate(
  templateId: string,
  updates: Partial<Pick<TemplateRow, "title" | "opening_heading" | "opening_body" | "opening_cta_label" | "is_active">>
): Promise<TemplateRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("questionnaire_templates")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", templateId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function createSection(
  templateId: string,
  input: { key: string; title: string; position: number; transitionHeading?: string; transitionSubheading?: string }
): Promise<SectionRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("questionnaire_sections")
    .insert({
      template_id: templateId,
      key: input.key,
      title: input.title,
      position: input.position,
      transition_heading: input.transitionHeading ?? null,
      transition_subheading: input.transitionSubheading ?? null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSection(
  sectionId: string,
  updates: Partial<{ title: string; position: number; transitionHeading: string | null; transitionSubheading: string | null }>
): Promise<SectionRow> {
  const db = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.position !== undefined) patch.position = updates.position;
  if (updates.transitionHeading !== undefined) patch.transition_heading = updates.transitionHeading;
  if (updates.transitionSubheading !== undefined) patch.transition_subheading = updates.transitionSubheading;

  const { data, error } = await db.from("questionnaire_sections").update(patch).eq("id", sectionId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteSection(sectionId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("questionnaire_sections").delete().eq("id", sectionId);
  if (error) throw error;
}

export async function createQuestion(
  sectionId: string,
  input: {
    key: string;
    position: number;
    prompt: string;
    subtext?: string | null;
    questionType: QuestionType;
    options?: QuestionOption[];
    allowUnsure?: boolean;
    required?: boolean;
    dependsOnQuestionKey?: string | null;
    dependsOnValues?: string[] | null;
  }
): Promise<QuestionRow> {
  const db = createAdminClient();
  const { data, error } = await db
    .from("questionnaire_questions")
    .insert({
      section_id: sectionId,
      key: input.key,
      position: input.position,
      prompt: input.prompt,
      subtext: input.subtext ?? null,
      question_type: input.questionType,
      options: input.options ?? [],
      allow_unsure: input.allowUnsure ?? true,
      required: input.required ?? false,
      depends_on_question_key: input.dependsOnQuestionKey ?? null,
      depends_on_values: input.dependsOnValues ?? null
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateQuestion(
  questionId: string,
  updates: Partial<{
    prompt: string;
    subtext: string | null;
    position: number;
    questionType: QuestionType;
    options: QuestionOption[];
    allowUnsure: boolean;
    required: boolean;
    dependsOnQuestionKey: string | null;
    dependsOnValues: string[] | null;
  }>
): Promise<QuestionRow> {
  const db = createAdminClient();
  const patch: Record<string, unknown> = {};
  if (updates.prompt !== undefined) patch.prompt = updates.prompt;
  if (updates.subtext !== undefined) patch.subtext = updates.subtext;
  if (updates.position !== undefined) patch.position = updates.position;
  if (updates.questionType !== undefined) patch.question_type = updates.questionType;
  if (updates.options !== undefined) patch.options = updates.options;
  if (updates.allowUnsure !== undefined) patch.allow_unsure = updates.allowUnsure;
  if (updates.required !== undefined) patch.required = updates.required;
  if (updates.dependsOnQuestionKey !== undefined) patch.depends_on_question_key = updates.dependsOnQuestionKey;
  if (updates.dependsOnValues !== undefined) patch.depends_on_values = updates.dependsOnValues;

  const { data, error } = await db.from("questionnaire_questions").update(patch).eq("id", questionId).select().single();
  if (error) throw error;
  return data;
}

export async function deleteQuestion(questionId: string): Promise<void> {
  const db = createAdminClient();
  const { error } = await db.from("questionnaire_questions").delete().eq("id", questionId);
  if (error) throw error;
}
