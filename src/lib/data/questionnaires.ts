import { createAdminClient } from "@/lib/supabase/admin";
import type { Template, Section, Question, Answers } from "@/lib/questionnaire-engine";

export interface QuestionnaireResponseRow {
  id: string;
  event_id: string;
  template_id: string;
  answers: Answers;
  current_question_key: string | null;
  completed_at: string | null;
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

  const { data: sections, error: sectionsError } = await db
    .from("questionnaire_sections")
    .select("*")
    .eq("template_id", template.id)
    .order("position");
  if (sectionsError) throw sectionsError;

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: questions, error: questionsError } =
    sectionIds.length > 0
      ? await db.from("questionnaire_questions").select("*").in("section_id", sectionIds).order("position")
      : { data: [] as Question[], error: null };
  if (questionsError) throw questionsError;

  const sectionsOut: Section[] = (sections ?? []).map((s) => ({
    id: s.id,
    key: s.key,
    title: s.title,
    position: s.position,
    transition_heading: s.transition_heading,
    transition_subheading: s.transition_subheading,
    questions: (questions ?? [])
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
