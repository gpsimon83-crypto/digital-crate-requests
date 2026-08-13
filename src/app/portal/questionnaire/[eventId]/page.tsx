"use client";

import { use as usePromise, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { NeonButton } from "@/components/ui/neon-button";
import { QuestionInput } from "@/components/portal/questionnaire/question-input";
import {
  getVisibleQuestions,
  isAnswered,
  computeProgress,
  findFlatIndex,
  formatAnswerValue,
  type Answers,
  type AnswerValue,
  type Template
} from "@/lib/questionnaire-engine";

interface QuestionnaireResponse {
  answers: Answers;
  current_question_key: string | null;
  completed_at: string | null;
}

type Phase = "loading" | "unavailable" | "error" | "opening" | "resume" | "transition" | "question" | "review" | "done";

export default function QuestionnairePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = usePromise(params);
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("loading");
  const [template, setTemplate] = useState<Template | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [currentKey, setCurrentKey] = useState<string | null>(null);
  const [returnToReview, setReturnToReview] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [savedCompletedAt, setSavedCompletedAt] = useState<string | null>(null);
  const [savedCurrentKey, setSavedCurrentKey] = useState<string | null>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch(`/api/portal/events/${eventId}/questionnaire`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load questionnaire");
        if (!data.template) {
          setPhase("unavailable");
          return;
        }
        setTemplate(data.template);
        const response: QuestionnaireResponse | null = data.response;
        if (response) {
          setAnswers(response.answers ?? {});
          setSavedCompletedAt(response.completed_at);
          setSavedCurrentKey(response.current_question_key);
        }
        if (response?.completed_at) {
          setPhase("done");
        } else if (response && Object.keys(response.answers ?? {}).length > 0) {
          setPhase("resume");
        } else {
          setPhase("opening");
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setPhase("error");
      });
  }, [eventId]);

  const flat = useMemo(() => (template ? getVisibleQuestions(template.sections, answers) : []), [template, answers]);
  const currentIndex = findFlatIndex(flat, currentKey);
  const currentFlatItem = currentIndex >= 0 ? flat[currentIndex] : null;
  const progress = computeProgress(flat, answers);

  async function persist(baseAnswers: Answers, extra?: { currentQuestionKey?: string | null }) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    try {
      await fetch(`/api/portal/events/${eventId}/questionnaire`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: baseAnswers,
          ...(extra?.currentQuestionKey !== undefined ? { currentQuestionKey: extra.currentQuestionKey } : {})
        })
      });
    } catch {
      // best-effort autosave; the next successful save (or Save & Exit) will catch up
    }
  }

  function scheduleSave(baseAnswers: Answers) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => persist(baseAnswers), 900);
  }

  // Records an answer without navigating (multi-select toggles, text fields).
  function setAnswer(key: string, value: AnswerValue) {
    const next = { ...answers, [key]: value };
    setAnswers(next);
    setValidationError(null);
    scheduleSave(next);
  }

  // Single source of truth for moving off a question. Takes the answers
  // object explicitly (rather than reading component state) so it can be
  // called in the same tick as the answer that triggered it — component
  // state from setAnswers isn't readable until the next render, so a
  // same-tick "select and advance" would otherwise validate against the
  // answer from before the click.
  function advanceFrom(key: string, nextAnswers: Answers) {
    if (returnToReview) {
      persist(nextAnswers, { currentQuestionKey: key });
      setReturnToReview(false);
      setPhase("review");
      return;
    }
    const freshFlat = template ? getVisibleQuestions(template.sections, nextAnswers) : [];
    const idx = findFlatIndex(freshFlat, key);
    const item = idx >= 0 ? freshFlat[idx] : null;
    const nextItem = item ? freshFlat[idx + 1] : undefined;
    if (!item || !nextItem) {
      persist(nextAnswers, { currentQuestionKey: null });
      setPhase("review");
      return;
    }
    const enteringNewSection = nextItem.section.id !== item.section.id;
    persist(nextAnswers, { currentQuestionKey: nextItem.question.key });
    setCurrentKey(nextItem.question.key);
    setPhase(enteringNewSection ? "transition" : "question");
  }

  // Used by single-select tap-to-advance: records the tapped value and
  // advances atomically, off the same nextAnswers object.
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

  function handleResume() {
    let key: string | null = savedCurrentKey && findFlatIndex(flat, savedCurrentKey) >= 0 ? savedCurrentKey : null;
    if (!key) {
      const firstUnanswered = flat.find((f) => !isAnswered(answers, f.question.key));
      key = firstUnanswered?.question.key ?? flat[0]?.question.key ?? null;
    }
    if (!key) {
      setPhase("review");
      return;
    }
    setCurrentKey(key);
    setPhase("question");
  }

  function handleContinue() {
    if (!currentFlatItem) return;
    const q = currentFlatItem.question;
    if (q.required && !isAnswered(answers, q.key)) {
      setValidationError("This one's required — pick an answer, or let us know you'll decide later.");
      return;
    }
    setValidationError(null);
    advanceFrom(q.key, answers);
  }

  function handleUnsure() {
    if (!currentFlatItem) return;
    commitAndAdvance(currentFlatItem.question.key, { unsure: true });
  }

  function goBack() {
    if (currentIndex <= 0) return;
    const prevItem = flat[currentIndex - 1];
    persist(answers, { currentQuestionKey: prevItem.question.key });
    setCurrentKey(prevItem.question.key);
    setValidationError(null);
    setPhase("question");
  }

  function editFromReview(key: string) {
    setCurrentKey(key);
    setReturnToReview(true);
    setPhase("question");
  }

  async function handleSaveExit() {
    await persist(answers, { currentQuestionKey: currentKey });
    router.push(`/portal/events/${eventId}?tab=services`);
  }

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await persist(answers, { currentQuestionKey: null });
      const res = await fetch(`/api/portal/events/${eventId}/questionnaire/submit`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to submit");
      setSavedCompletedAt(data.response.completed_at);
      setPhase("done");
    } catch (err) {
      setValidationError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  if (phase === "loading") {
    return <CenteredShell><p className="text-sm text-muted">Loading...</p></CenteredShell>;
  }

  if (phase === "error") {
    return (
      <CenteredShell>
        <p className="text-sm text-status-declined">{error}</p>
        <BackToEventLink eventId={eventId} />
      </CenteredShell>
    );
  }

  if (phase === "unavailable") {
    return (
      <CenteredShell>
        <p className="font-display text-2xl font-light">Questionnaire coming soon</p>
        <p className="mt-2 text-sm text-muted">There isn&rsquo;t a planning questionnaire set up for this event type yet.</p>
        <BackToEventLink eventId={eventId} />
      </CenteredShell>
    );
  }

  if (!template) return null;

  if (phase === "opening") {
    return (
      <CenteredShell>
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">{template.title}</p>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight">{template.opening_heading}</h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">{template.opening_body}</p>
        <NeonButton color="gold" onClick={handleStart} className="mt-8">
          {template.opening_cta_label} <ArrowRight size={16} />
        </NeonButton>
        <BackToEventLink eventId={eventId} />
      </CenteredShell>
    );
  }

  if (phase === "resume") {
    return (
      <CenteredShell>
        <p className="text-xs font-semibold uppercase tracking-wide text-gold">{template.title}</p>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight">Welcome back</h1>
        <p className="mt-4 text-sm text-muted">You&rsquo;re {progress}% complete. Pick up right where you left off.</p>
        <div className="mt-4 h-1.5 w-64 overflow-hidden rounded-full bg-black/10">
          <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
        </div>
        <NeonButton color="gold" onClick={handleResume} className="mt-8">
          Continue <ArrowRight size={16} />
        </NeonButton>
        <BackToEventLink eventId={eventId} />
      </CenteredShell>
    );
  }

  if (phase === "transition" && currentFlatItem) {
    const section = currentFlatItem.section;
    return (
      <CenteredShell>
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
        <TopBar template={template} progress={progress} onSaveExit={handleSaveExit} />
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
                  onSelectAdvance={
                    question.question_type === "single_select" ? (v: string) => commitAndAdvance(question.key, { value: v }) : undefined
                  }
                />
              )}
            </div>

            {validationError && <p className="mt-3 text-sm text-status-declined">{validationError}</p>}

            <div className="mt-8 flex items-center justify-between">
              <button
                onClick={goBack}
                disabled={currentIndex <= 0}
                className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground disabled:opacity-0"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <div className="flex items-center gap-4">
                {question.allow_unsure && !showingUnsure && (
                  <button onClick={handleUnsure} className="text-sm text-muted hover:text-foreground">
                    I&rsquo;ll decide later
                  </button>
                )}
                <NeonButton color="gold" onClick={handleContinue}>
                  {returnToReview ? "Save" : "Continue"} <ArrowRight size={16} />
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
        <TopBar template={template} progress={progress} onSaveExit={handleSaveExit} />
        <div className="mx-auto w-full max-w-2xl flex-1 px-6 py-10">
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">Review</p>
          <h1 className="mt-2 font-display text-3xl font-light">Let&rsquo;s make sure we got it all</h1>
          <p className="mt-2 text-sm text-muted">Tap any answer to change it.</p>

          <div className="mt-8 flex flex-col gap-8">
            {template.sections.map((section) => {
              const items = flat.filter((f) => f.section.id === section.id);
              if (items.length === 0) return null;
              return (
                <div key={section.id}>
                  <p className="mb-3 border-b border-border pb-2 text-xs font-semibold uppercase tracking-wide text-gold">{section.title}</p>
                  <div className="flex flex-col gap-3">
                    {items.map(({ question }) => (
                      <button
                        key={question.key}
                        onClick={() => editFromReview(question.key)}
                        className="flex items-start justify-between gap-4 rounded-[2px] border border-black/10 bg-panel px-4 py-3 text-left hover:border-gold/50"
                      >
                        <span className="text-sm">
                          <span className="block text-muted">{question.prompt}</span>
                          <span className="mt-0.5 block font-medium">{formatAnswer(question, answers[question.key])}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {validationError && <p className="mt-4 text-sm text-status-declined">{validationError}</p>}

          <NeonButton color="gold" onClick={handleSubmit} disabled={submitting} className="mt-8">
            {submitting ? "Submitting..." : "Submit"} <Check size={16} />
          </NeonButton>
        </div>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <CenteredShell>
        <Check size={40} className="text-gold" />
        <h1 className="mt-4 font-display text-4xl font-light leading-tight">All set!</h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
          {savedCompletedAt
            ? `Thanks — your DJ has everything they need. Submitted ${new Date(savedCompletedAt).toLocaleDateString()}.`
            : "Thanks — your DJ has everything they need."}
        </p>
        <div className="mt-8 flex items-center gap-4">
          <NeonButton color="gold" onClick={() => setPhase("review")}>
            Review my answers
          </NeonButton>
        </div>
        <BackToEventLink eventId={eventId} />
      </CenteredShell>
    );
  }

  return null;
}

function TopBar({
  template,
  progress,
  onSaveExit
}: {
  template: Template;
  progress: number;
  onSaveExit: () => void;
}) {
  return (
    <div className="border-b border-border">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-6 py-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-gold">{template.title}</p>
        </div>
        <button onClick={onSaveExit} className="text-xs font-medium text-muted hover:text-foreground">
          Save &amp; Exit
        </button>
      </div>
      <div className="h-1 w-full bg-black/10">
        <div className="h-full bg-gold transition-all" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 text-center">
      {children}
    </div>
  );
}

function BackToEventLink({ eventId }: { eventId: string }) {
  return (
    <Link href={`/portal/events/${eventId}`} className="mt-6 flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
      <ArrowLeft size={14} /> Back to your event
    </Link>
  );
}

function formatAnswer(question: { options: { value: string; label: string }[] }, value: AnswerValue | undefined): string {
  return formatAnswerValue(question, value, "You'll decide later");
}
