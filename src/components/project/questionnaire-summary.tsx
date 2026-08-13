"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { getVisibleQuestions, isAnswered, computeProgress, formatAnswerValue, type Question, type Section, type Answers } from "@/lib/questionnaire-engine";

interface ResponseRow {
  answers: Answers;
  completed_at: string | null;
}

export function QuestionnaireSummary({ eventId }: { eventId: string }) {
  const [response, setResponse] = useState<ResponseRow | null | undefined>(undefined);
  const [sections, setSections] = useState<Section[]>([]);

  useEffect(() => {
    fetch(`/api/events/${eventId}/questionnaire-response`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error);
        setResponse(data.response);
        if (data.response) {
          const built: Section[] = (data.sections as Section[])
            .slice()
            .sort((a, b) => a.position - b.position)
            .map((s) => ({
              ...s,
              questions: (data.questions as (Question & { section_id: string })[])
                .filter((q) => q.section_id === s.id)
                .sort((a, b) => a.position - b.position)
            }));
          setSections(built);
        }
      })
      .catch(() => setResponse(null));
  }, [eventId]);

  if (response === undefined) return null;

  if (!response) {
    return (
      <GlassCard className="flex flex-col gap-1">
        <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Planning Questionnaire</p>
        <p className="text-sm text-muted">The client hasn&rsquo;t started this event&rsquo;s planning questionnaire yet.</p>
      </GlassCard>
    );
  }

  const flat = getVisibleQuestions(sections, response.answers).filter((f) => isAnswered(response.answers, f.question.key));
  const progress = computeProgress(getVisibleQuestions(sections, response.answers), response.answers);
  const bySections = new Map<string, { title: string; items: typeof flat }>();
  for (const f of flat) {
    const existing = bySections.get(f.section.id);
    if (existing) existing.items.push(f);
    else bySections.set(f.section.id, { title: f.section.title, items: [f] });
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Planning Questionnaire</p>
        <span className={response.completed_at ? "text-xs font-medium text-status-approved" : "text-xs font-medium text-status-pending"}>
          {response.completed_at ? "Completed" : `In progress — ${progress}%`}
        </span>
      </div>

      {flat.length === 0 ? (
        <p className="text-sm text-muted">No answers yet.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {Array.from(bySections.values()).map((section) => (
            <div key={section.title}>
              <p className="mb-1.5 text-[10px] uppercase tracking-wide text-gold">{section.title}</p>
              <div className="flex flex-col gap-1.5">
                {section.items.map(({ question }) => (
                  <div key={question.key} className="text-sm">
                    <span className="text-muted">{question.prompt}: </span>
                    <span>{formatAnswerValue(question, response.answers[question.key])}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
