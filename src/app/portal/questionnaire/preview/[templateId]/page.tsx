"use client";

import { use as usePromise, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { NeonButton } from "@/components/ui/neon-button";
import { QuestionInput } from "@/components/portal/questionnaire/question-input";
import {
  getVisibleQuestions,
  computeProgress,
  findFlatIndex,
  formatAnswerValue,
  type Answers,
  type AnswerValue,
  type Template,
  type Question
} from "@/lib/questionnaire-engine";

type Phase = "loading" | "error" | "opening" | "transition" | "question" | "review" | "done";

/**
 * Admin-only, read-only run-through of a template — no event, no client,
 * nothing ever saved. Exists so an admin can sanity-check a questionnaire
 * (including conditional branches) exactly as a client would experience
 * it, without needing a real event to attach it to.
 */
export default function QuestionnairePreviewPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = usePromise(params);

  const [phase, setPhase] = useState<Phase>("loading");
  const [template, setTemplate] = useState<Template | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/admin/questionnaires/${templateId}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load template");
        const sections = (data.sections as { id: string; key: string; title: string; position: number; transition_heading: string | null; transition_subheading: string | null }[])
          .sort((a, b) => a.position - b.position)
          .map((s) => ({
            ...s,
            questions: (data.questions as (Question & { section_id: string })[])
              .filter((q) => q.section_id === s.id)
              .sort((a, b) => a.position - b.position)
          }));
        setTemplate({ ...data.template, sections });
        setPhase("opening");
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setPhase("error");
      });
  }, [templateId]);

  const flat = useMemo(() => (template ? getVisibleQuestions(template.sections, answers) : []), [template, answers]);
  const currentIndex = findFlatIndex(flat, currentKey);
  const currentFlatItem = currentIndex >= 0 ? flat[currentIndex] : null;
  const progress = computeProgress(flat, answers);

  function setAnswer(key: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [key]: value }));
  }

  function advanceFrom(key: string, nextAnswers: Answers) {
    const freshFlat = template ? getVisibleQuestions(template.sections, nextAnswers) : [];
    const idx = findFlatIndex(freshFlat, key);
    const item = idx >= 0 ? freshFlat[idx] : null;
    const nextItem = item ? freshFlat[idx + 1] : undefined;
    if (!item || !nextItem) {
      setPhase("review");
      return;
    }
    const enteringNewSection = nextItem.section.id !== item.section.id;
    setCurrentKey(nextItem.question.key);
    setPhase(enteringNewSection ? "transition" : "question");
  }

  function commitAndAdvance(key: string, value: AnswerValue) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    advanceFrom(key, next);
  }

  function handleStart() {
    if (flat.length === 0) return;
    setCurrentKey(flat[0].question.key);
    setPhase("transition");
  }

  function handleContinue() {
    if (!currentFlatItem) return;
    advanceFrom(currentFlatItem.question.key, answers);
  }

  function handleUnsure() {
    if (!currentFlatItem) return;
    commitAndAdvance(currentFlatItem.question.key, { unsure: true });
  }

  function goBack() {
    if (currentIndex <= 0) return;
    setCurrentKey(flat[currentIndex - 1].question.key);
    setPhase("question");
  }

  if (phase === "loading") return <CenteredShell><p className="text-sm text-muted">Loading...</p></CenteredShell>;
  if (phase === "error") return <CenteredShell><p className="text-sm text-status-declined">{error}</p></CenteredShell>;
  if (!template) return null;

  if (phase === "opening") {
    return (
      <CenteredShell>
        <PreviewBanner />
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">{template.title}</p>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight">{template.opening_heading}</h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">{template.opening_body}</p>
        <NeonButton color="gold" onClick={handleStart} className="mt-8">
          {template.opening_cta_label} <ArrowRight size={16} />
        </NeonButton>
      </CenteredShell>
    );
  }

  if (phase === "transition" && currentFlatItem) {
    const section = currentFlatItem.section;
    return (
      <CenteredShell>
        <PreviewBanner />
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">{template.title}</p>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight">{section.transition_heading || section.title}</h1>
        {section.transition_subheading && <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">{section.transition_subheading}</p>}
        <NeonButton color="gold" onClick={() => setPhase("question")} className="mt-8">
          Continue <ArrowRight size={16} />
        </NeonButton>
      </CenteredShell>
    );
  }

  if (phase === "question" && currentFlatItem) {
    const { section, question } = currentFlatItem;
    const value = answers[question.key];
    const showingUnsure = value && "unsure" in value;

    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <TopBar template={template} progress={progress} />
        <div className="flex flex-1 flex-col items-center justify-center px-6 py-10">
          <div className="w-full max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-wide text-gold">{section.title}</p>
            <h2 className="mt-2 font-display text-3xl font-light leading-tight">{question.prompt}</h2>
            {question.subtext && <p className="mt-2 text-sm text-muted">{question.subtext}</p>}

            <div className="mt-6">
              {showingUnsure ? (
                <div className="rounded-[2px] border border-dashed border-black/20 bg-panel px-5 py-4 text-sm text-muted">
                  You&rsquo;ll decide this later.{" "}
                  <button className="text-gold hover:underline" onClick={() => setAnswer(question.key, { value: "" })}>
                    Answer now instead
                  </button>
                </div>
              ) : (
                <QuestionInput
                  question={question}
                  value={value}
                  onChange={(v) => setAnswer(question.key, v)}
                  onSelectAdvance={question.question_type === "single_select" ? (v: string) => commitAndAdvance(question.key, { value: v }) : undefined}
                />
              )}
            </div>

            <div className="mt-8 flex items-center justify-between">
              <button onClick={goBack} disabled={currentIndex <= 0} className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground disabled:opacity-0">
                <ArrowLeft size={14} /> Back
              </button>
              <div className="flex items-center gap-4">
                {question.allow_unsure && !showingUnsure && (
                  <button onClick={handleUnsure} className="text-sm text-muted hover:text-foreground">
                    I&rsquo;ll decide later
                  </button>
                )}
                <NeonButton color="gold" onClick={handleContinue}>
                  Continue <ArrowRight size={16} />
                </NeonButton>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "review") {
    return (
      <div className="flex min-h-dvh flex-col bg-background">
        <TopBar template={template} progress={progress} />
        <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">Review</p>
          <h1 className="mt-2 font-display text-3xl font-light">Preview complete</h1>
          <p className="mt-2 text-sm text-muted">This is what a client&rsquo;s review screen looks like. Nothing here is saved.</p>

          <div className="mt-8 flex flex-col gap-8">
            {template.sections.map((section) => {
              const items = flat.filter((f) => f.section.id === section.id);
              if (items.length === 0) return null;
              return (
                <div key={section.id}>
                  <p className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-gold">{section.title}</p>
                  <div className="flex flex-col gap-3">
                    {items.map(({ question }) => (
                      <div key={question.key} className="rounded-[2px] border border-black/10 bg-panel px-4 py-3">
                        <span className="block text-sm text-muted">{question.prompt}</span>
                        <span className="mt-0.5 block text-sm font-medium">{formatAnswer(question, answers[question.key])}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <NeonButton color="gold" onClick={() => setPhase("done")} className="mt-8">
            Finish Preview <Check size={16} />
          </NeonButton>
        </div>
      </div>
    );
  }

  return (
    <CenteredShell>
      <Check size={40} className="text-gold" />
      <h1 className="mt-4 font-display text-4xl font-light leading-tight">Preview complete</h1>
      <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">Nothing was saved — this was just a run-through.</p>
      <Link href={`/admin/questionnaires/${templateId}`} className="mt-8 flex items-center gap-1.5 text-sm text-gold hover:underline">
        <ArrowLeft size={14} /> Back to builder
      </Link>
    </CenteredShell>
  );
}

function PreviewBanner() {
  return (
    <p className="mb-6 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gold">
      Preview — nothing is saved
    </p>
  );
}

function TopBar({ template, progress }: { template: Template; progress: number }) {
  return (
    <div className="border-b border-border">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">{template.title}</p>
        <span className="rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-gold">Preview</span>
      </div>
      <div className="h-1 w-full bg-black/10">
        <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-center">{children}</div>;
}

function formatAnswer(question: { options: { value: string; label: string }[] }, value: AnswerValue | undefined): string {
  return formatAnswerValue(question, value, "You'll decide later");
}
