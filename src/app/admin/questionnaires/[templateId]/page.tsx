"use client";

import { use as usePromise, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { cn } from "@/lib/utils";
import { ArrowLeft, ChevronDown, ChevronUp, Trash2, Plus, ExternalLink } from "lucide-react";
import type { QuestionType, QuestionOption } from "@/lib/questionnaire-engine";

interface TemplateRow {
  id: string;
  event_type: string;
  title: string;
  opening_heading: string;
  opening_body: string;
  opening_cta_label: string;
  is_active: boolean;
}

interface SectionRow {
  id: string;
  template_id: string;
  key: string;
  title: string;
  position: number;
  transition_heading: string | null;
  transition_subheading: string | null;
}

interface QuestionRow {
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

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  single_select: "Single Select",
  multi_select: "Multi Select",
  short_text: "Short Text",
  long_text: "Long Text",
  person_list: "Person List",
  song: "Song",
  time: "Time"
};

const HAS_OPTIONS: QuestionType[] = ["single_select", "multi_select"];

const inputClass = "w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";
const labelClass = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted";

function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
}

// Kept outside the component so the impure Date.now() fallback (used only
// when a prompt slugifies to nothing, or collides with an existing key)
// isn't reachable from render.
function uniqueKey(text: string, existingKeys: Set<string>): string {
  const base = slugify(text) || `item_${Date.now()}`;
  if (!existingKeys.has(base)) return base;
  return `${base}_${Date.now().toString().slice(-4)}`;
}

export default function QuestionnaireBuilderPage({ params }: { params: Promise<{ templateId: string }> }) {
  const { templateId } = usePromise(params);

  const [template, setTemplate] = useState<TemplateRow | null>(null);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [questions, setQuestions] = useState<QuestionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [openingHeading, setOpeningHeading] = useState("");
  const [openingBody, setOpeningBody] = useState("");
  const [openingCta, setOpeningCta] = useState("");
  const [savingOpening, setSavingOpening] = useState(false);
  const [pendingDeleteSection, setPendingDeleteSection] = useState<SectionRow | null>(null);
  const [pendingDeleteQuestion, setPendingDeleteQuestion] = useState<QuestionRow | null>(null);

  function load() {
    fetch(`/api/admin/questionnaires/${templateId}`)
      .then((r) => r.json().then((data) => ({ ok: r.ok, data })))
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data.error || "Failed to load template");
        setTemplate(data.template);
        setSections(data.sections);
        setQuestions(data.questions);
        setOpeningHeading(data.template.opening_heading);
        setOpeningBody(data.template.opening_body);
        setOpeningCta(data.template.opening_cta_label);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Something went wrong."));
  }

  useEffect(load, [templateId]);

  // Flat, ordered list of every question across every section — used both
  // to render the page in the right order and to compute, for each
  // question, which earlier questions are valid "depends on" targets.
  const orderedQuestions = useMemo(() => {
    const out: { section: SectionRow; question: QuestionRow }[] = [];
    for (const s of [...sections].sort((a, b) => a.position - b.position)) {
      for (const q of questions.filter((q) => q.section_id === s.id).sort((a, b) => a.position - b.position)) {
        out.push({ section: s, question: q });
      }
    }
    return out;
  }, [sections, questions]);

  function priorQuestions(questionId: string): QuestionRow[] {
    const idx = orderedQuestions.findIndex((f) => f.question.id === questionId);
    if (idx === -1) return orderedQuestions.map((f) => f.question);
    return orderedQuestions.slice(0, idx).map((f) => f.question);
  }

  async function handleToggleActive() {
    if (!template) return;
    const nextActive = !template.is_active;
    setTemplate({ ...template, is_active: nextActive });
    await fetch(`/api/admin/questionnaires/${templateId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: nextActive })
    });
  }

  async function handleSaveOpening() {
    setSavingOpening(true);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/questionnaires/${templateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ openingHeading, openingBody, openingCtaLabel: openingCta })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setTemplate(data.template);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingOpening(false);
    }
  }

  async function handleAddSection() {
    const title = window.prompt("Chapter title (e.g. \"Reception Timeline\")");
    if (!title?.trim()) return;
    const key = uniqueKey(title, new Set(sections.map((s) => s.key)));
    const res = await fetch(`/api/admin/questionnaires/${templateId}/sections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, title: title.trim(), position: sections.length, transitionHeading: title.trim() })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to add chapter");
      return;
    }
    setSections((prev) => [...prev, data.section]);
  }

  async function handleUpdateSection(section: SectionRow, updates: Partial<SectionRow>) {
    setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, ...updates } : s)));
    await fetch(`/api/admin/questionnaires/sections/${section.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: updates.title,
        position: updates.position,
        transitionHeading: updates.transition_heading,
        transitionSubheading: updates.transition_subheading
      })
    });
  }

  async function handleMoveSection(section: SectionRow, direction: -1 | 1) {
    const ordered = [...sections].sort((a, b) => a.position - b.position);
    const idx = ordered.findIndex((s) => s.id === section.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= ordered.length) return;
    const other = ordered[swapIdx];

    setSections((prev) => prev.map((s) => (s.id === section.id ? { ...s, position: other.position } : s.id === other.id ? { ...s, position: section.position } : s)));
    await Promise.all([
      fetch(`/api/admin/questionnaires/sections/${section.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: other.position }) }),
      fetch(`/api/admin/questionnaires/sections/${other.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: section.position }) })
    ]);
  }

  async function handleDeleteSection(section: SectionRow) {
    setSections((prev) => prev.filter((s) => s.id !== section.id));
    setQuestions((prev) => prev.filter((q) => q.section_id !== section.id));
    await fetch(`/api/admin/questionnaires/sections/${section.id}`, { method: "DELETE" });
    setPendingDeleteSection(null);
  }

  async function handleAddQuestion(section: SectionRow) {
    const prompt = window.prompt("Question prompt (what the client sees)");
    if (!prompt?.trim()) return;
    const finalKey = uniqueKey(prompt, new Set(questions.map((q) => q.key)));
    const position = questions.filter((q) => q.section_id === section.id).length;

    const res = await fetch(`/api/admin/questionnaires/sections/${section.id}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: finalKey, position, prompt: prompt.trim(), questionType: "short_text" })
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Failed to add question");
      return;
    }
    setQuestions((prev) => [...prev, data.question]);
  }

  async function handleUpdateQuestion(question: QuestionRow, updates: Partial<QuestionRow>) {
    setQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, ...updates } : q)));
    await fetch(`/api/admin/questionnaires/questions/${question.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: updates.prompt,
        subtext: updates.subtext,
        position: updates.position,
        questionType: updates.question_type,
        options: updates.options,
        allowUnsure: updates.allow_unsure,
        required: updates.required,
        dependsOnQuestionKey: updates.depends_on_question_key,
        dependsOnValues: updates.depends_on_values
      })
    });
  }

  async function handleMoveQuestion(question: QuestionRow, direction: -1 | 1) {
    const siblings = questions.filter((q) => q.section_id === question.section_id).sort((a, b) => a.position - b.position);
    const idx = siblings.findIndex((q) => q.id === question.id);
    const swapIdx = idx + direction;
    if (swapIdx < 0 || swapIdx >= siblings.length) return;
    const other = siblings[swapIdx];

    setQuestions((prev) => prev.map((q) => (q.id === question.id ? { ...q, position: other.position } : q.id === other.id ? { ...q, position: question.position } : q)));
    await Promise.all([
      fetch(`/api/admin/questionnaires/questions/${question.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: other.position }) }),
      fetch(`/api/admin/questionnaires/questions/${other.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ position: question.position }) })
    ]);
  }

  async function handleDeleteQuestion(question: QuestionRow) {
    setQuestions((prev) => prev.filter((q) => q.id !== question.id));
    await fetch(`/api/admin/questionnaires/questions/${question.id}`, { method: "DELETE" });
    setPendingDeleteQuestion(null);
  }

  if (error && !template) {
    return (
      <>
        <PageHeader title="Questionnaire Builder" action={<BackLink />} />
        <p className="p-6 text-sm text-status-declined">{error}</p>
      </>
    );
  }

  if (!template) {
    return (
      <>
        <PageHeader title="Questionnaire Builder" action={<BackLink />} />
        <p className="p-6 text-sm text-muted">Loading...</p>
      </>
    );
  }

  const orderedSections = [...sections].sort((a, b) => a.position - b.position);

  return (
    <>
      <PageHeader
        title={template.title}
        subtitle={`/${template.event_type}`}
        action={
          <div className="flex items-center gap-2">
            <a href={`/portal/questionnaire/preview/${templateId}`} target="_blank" rel="noreferrer">
              <button className="flex items-center gap-1.5 rounded-[10px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-black/25 hover:text-foreground">
                Preview <ExternalLink size={13} />
              </button>
            </a>
            <button
              onClick={handleToggleActive}
              className={cn(
                "rounded-[10px] border px-3.5 py-2 text-xs font-medium transition-colors",
                template.is_active ? "border-status-approved/40 text-status-approved hover:bg-status-approved/10" : "border-black/12 text-muted hover:border-black/25"
              )}
            >
              {template.is_active ? "Active" : "Inactive"}
            </button>
            <BackLink />
          </div>
        }
      />

      <div className="flex flex-col gap-6 p-6">
        {error && <p className="text-sm text-status-declined">{error}</p>}

        <GlassCard className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Opening Screen</p>
          <label className="block">
            <span className={labelClass}>Heading</span>
            <input value={openingHeading} onChange={(e) => setOpeningHeading(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Body</span>
            <textarea value={openingBody} onChange={(e) => setOpeningBody(e.target.value)} className={cn(inputClass, "min-h-[70px]")} />
          </label>
          <label className="block">
            <span className={labelClass}>Button Label</span>
            <input value={openingCta} onChange={(e) => setOpeningCta(e.target.value)} className={inputClass} />
          </label>
          <div className="flex items-center gap-3">
            <Button variant="cta" onClick={handleSaveOpening} disabled={savingOpening} className="w-fit">
              {savingOpening ? "Saving..." : "Save Opening Screen"}
            </Button>
            {saved && <p className="text-xs text-status-approved">Saved.</p>}
          </div>
        </GlassCard>

        {orderedSections.map((section) => (
          <SectionBlock
            key={section.id}
            section={section}
            questions={questions.filter((q) => q.section_id === section.id).sort((a, b) => a.position - b.position)}
            priorQuestions={priorQuestions}
            onUpdateSection={(updates) => handleUpdateSection(section, updates)}
            onMoveSection={(dir) => handleMoveSection(section, dir)}
            onDeleteSection={() => setPendingDeleteSection(section)}
            onAddQuestion={() => handleAddQuestion(section)}
            onUpdateQuestion={handleUpdateQuestion}
            onMoveQuestion={handleMoveQuestion}
            onDeleteQuestion={setPendingDeleteQuestion}
          />
        ))}

        <button
          onClick={handleAddSection}
          className="flex w-fit items-center gap-1.5 rounded-[10px] border border-dashed border-black/20 px-4 py-2.5 text-sm font-medium text-muted hover:border-gold hover:text-gold"
        >
          <Plus size={15} /> Add Chapter
        </button>
      </div>

      <ConfirmModal
        open={!!pendingDeleteSection}
        title={pendingDeleteSection ? `Delete "${pendingDeleteSection.title}"?` : ""}
        body={
          pendingDeleteSection && questions.filter((q) => q.section_id === pendingDeleteSection.id).length > 0
            ? `This will also delete its ${questions.filter((q) => q.section_id === pendingDeleteSection.id).length} question(s). This can't be undone.`
            : "This can't be undone."
        }
        confirmLabel="Delete"
        onConfirm={() => pendingDeleteSection && handleDeleteSection(pendingDeleteSection)}
        onCancel={() => setPendingDeleteSection(null)}
      />

      <ConfirmModal
        open={!!pendingDeleteQuestion}
        title={pendingDeleteQuestion ? `Delete "${pendingDeleteQuestion.prompt}"?` : ""}
        body="This can't be undone."
        confirmLabel="Delete"
        onConfirm={() => pendingDeleteQuestion && handleDeleteQuestion(pendingDeleteQuestion)}
        onCancel={() => setPendingDeleteQuestion(null)}
      />
    </>
  );
}

function BackLink() {
  return (
    <Link
      href="/admin/questionnaires"
      className="flex items-center gap-1.5 rounded-[10px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-black/25 hover:text-foreground"
    >
      <ArrowLeft size={14} /> Back
    </Link>
  );
}

function SectionBlock({
  section,
  questions,
  priorQuestions,
  onUpdateSection,
  onMoveSection,
  onDeleteSection,
  onAddQuestion,
  onUpdateQuestion,
  onMoveQuestion,
  onDeleteQuestion
}: {
  section: SectionRow;
  questions: QuestionRow[];
  priorQuestions: (questionId: string) => QuestionRow[];
  onUpdateSection: (updates: Partial<SectionRow>) => void;
  onMoveSection: (direction: -1 | 1) => void;
  onDeleteSection: () => void;
  onAddQuestion: () => void;
  onUpdateQuestion: (question: QuestionRow, updates: Partial<QuestionRow>) => void;
  onMoveQuestion: (question: QuestionRow, direction: -1 | 1) => void;
  onDeleteQuestion: (question: QuestionRow) => void;
}) {
  const [editingTransition, setEditingTransition] = useState(false);

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <input
          value={section.title}
          onChange={(e) => onUpdateSection({ title: e.target.value })}
          className="flex-1 border-none bg-transparent text-sm font-semibold outline-none focus:underline"
        />
        <div className="flex items-center gap-1">
          <button onClick={() => onMoveSection(-1)} className="p-1 text-muted hover:text-foreground" aria-label="Move chapter up">
            <ChevronUp size={15} />
          </button>
          <button onClick={() => onMoveSection(1)} className="p-1 text-muted hover:text-foreground" aria-label="Move chapter down">
            <ChevronDown size={15} />
          </button>
          <button onClick={() => setEditingTransition((v) => !v)} className="px-2 text-xs text-muted hover:text-gold">
            Transition copy
          </button>
          <button onClick={onDeleteSection} className="p-1 text-muted hover:text-status-declined" aria-label="Delete chapter">
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {editingTransition && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <label className="block">
            <span className={labelClass}>Transition Heading</span>
            <input
              value={section.transition_heading ?? ""}
              onChange={(e) => onUpdateSection({ transition_heading: e.target.value })}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Transition Subheading</span>
            <input
              value={section.transition_subheading ?? ""}
              onChange={(e) => onUpdateSection({ transition_subheading: e.target.value })}
              className={inputClass}
            />
          </label>
        </div>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        {questions.length === 0 && <p className="text-xs text-muted">No questions yet.</p>}
        {questions.map((q) => (
          <QuestionEditor
            key={q.id}
            question={q}
            priorQuestions={priorQuestions(q.id)}
            onUpdate={(updates) => onUpdateQuestion(q, updates)}
            onMove={(dir) => onMoveQuestion(q, dir)}
            onDelete={() => onDeleteQuestion(q)}
          />
        ))}
        <button onClick={onAddQuestion} className="flex w-fit items-center gap-1.5 text-xs font-medium text-muted hover:text-gold">
          <Plus size={13} /> Add Question
        </button>
      </div>
    </GlassCard>
  );
}

function QuestionEditor({
  question,
  priorQuestions,
  onUpdate,
  onMove,
  onDelete
}: {
  question: QuestionRow;
  priorQuestions: QuestionRow[];
  onUpdate: (updates: Partial<QuestionRow>) => void;
  onMove: (direction: -1 | 1) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const dependsOnQuestion = priorQuestions.find((p) => p.key === question.depends_on_question_key);

  function updateOption(idx: number, key: "value" | "label", val: string) {
    const next = question.options.map((o, i) => (i === idx ? { ...o, [key]: val } : o));
    onUpdate({ options: next });
  }

  function addOption() {
    onUpdate({ options: [...question.options, { value: `option_${question.options.length + 1}`, label: "" }] });
  }

  function removeOption(idx: number) {
    onUpdate({ options: question.options.filter((_, i) => i !== idx) });
  }

  return (
    <div className="rounded-[10px] border border-black/10 bg-panel p-3">
      <div className="flex items-start justify-between gap-3">
        <button onClick={() => setExpanded((v) => !v)} className="flex-1 text-left">
          <p className="text-sm font-medium">{question.prompt}</p>
          <p className="mt-0.5 text-xs text-muted">
            {QUESTION_TYPE_LABELS[question.question_type]}
            {question.required ? " · Required" : ""}
            {question.depends_on_question_key ? ` · Depends on "${dependsOnQuestion?.prompt ?? question.depends_on_question_key}"` : ""}
          </p>
        </button>
        <div className="flex items-center gap-1">
          <button onClick={() => onMove(-1)} className="p-1 text-muted hover:text-foreground" aria-label="Move question up">
            <ChevronUp size={14} />
          </button>
          <button onClick={() => onMove(1)} className="p-1 text-muted hover:text-foreground" aria-label="Move question down">
            <ChevronDown size={14} />
          </button>
          <button onClick={onDelete} className="p-1 text-muted hover:text-status-declined" aria-label="Delete question">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-black/10 pt-3">
          <label className="block">
            <span className={labelClass}>Prompt</span>
            <input value={question.prompt} onChange={(e) => onUpdate({ prompt: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Subtext (optional)</span>
            <input value={question.subtext ?? ""} onChange={(e) => onUpdate({ subtext: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Answer Type</span>
            <select
              value={question.question_type}
              onChange={(e) => onUpdate({ question_type: e.target.value as QuestionType })}
              className={inputClass}
            >
              {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>

          {HAS_OPTIONS.includes(question.question_type) && (
            <div>
              <span className={labelClass}>Answer Choices</span>
              <div className="flex flex-col gap-2">
                {question.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      value={opt.label}
                      onChange={(e) => updateOption(i, "label", e.target.value)}
                      placeholder="Label shown to client"
                      className={cn(inputClass, "flex-1")}
                    />
                    <button onClick={() => removeOption(i)} className="p-1 text-muted hover:text-status-declined">
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
                <button onClick={addOption} className="flex w-fit items-center gap-1.5 text-xs font-medium text-muted hover:text-gold">
                  <Plus size={13} /> Add Choice
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={question.required} onChange={(e) => onUpdate({ required: e.target.checked })} />
              Required
            </label>
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={question.allow_unsure} onChange={(e) => onUpdate({ allow_unsure: e.target.checked })} />
              Allow &ldquo;I&rsquo;ll decide later&rdquo;
            </label>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="block">
              <span className={labelClass}>Only show if...</span>
              <select
                value={question.depends_on_question_key ?? ""}
                onChange={(e) => {
                  const key = e.target.value || null;
                  onUpdate({ depends_on_question_key: key, depends_on_values: key ? question.depends_on_values ?? [] : null });
                }}
                className={inputClass}
              >
                <option value="">Always show</option>
                {priorQuestions
                  .filter((p) => HAS_OPTIONS.includes(p.question_type))
                  .map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.prompt}
                    </option>
                  ))}
              </select>
            </label>

            {dependsOnQuestion && (
              <label className="block">
                <span className={labelClass}>...answer is</span>
                <select
                  multiple
                  value={question.depends_on_values ?? []}
                  onChange={(e) => onUpdate({ depends_on_values: Array.from(e.target.selectedOptions, (o) => o.value) })}
                  className={cn(inputClass, "min-h-[70px]")}
                >
                  {dependsOnQuestion.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
