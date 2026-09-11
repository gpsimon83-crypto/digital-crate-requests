"use client";

import { use as usePromise, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { cn } from "@/lib/utils";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Trash2,
  Plus,
  ExternalLink,
  MessageSquareText,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Monitor,
  Smartphone,
  RefreshCw
} from "lucide-react";
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
const pillSelectClass =
  "shrink-0 rounded-full border border-border bg-panel px-3 py-1.5 text-xs font-medium text-foreground focus:border-gold focus:outline-none";

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

  const [activeTab, setActiveTab] = useState<string>("opening");
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">("desktop");
  const [previewNonce, setPreviewNonce] = useState(0);
  const bumpPreview = () => setPreviewNonce((n) => n + 1);

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
      bumpPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingOpening(false);
    }
  }

  async function handleAddSection() {
    const title = window.prompt('Chapter title (e.g. "Reception Timeline")');
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
    setActiveTab(data.section.id);
    bumpPreview();
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
    bumpPreview();
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
    bumpPreview();
  }

  async function handleDeleteSection(section: SectionRow) {
    const ordered = [...sections].sort((a, b) => a.position - b.position);
    const idx = ordered.findIndex((s) => s.id === section.id);
    setSections((prev) => prev.filter((s) => s.id !== section.id));
    setQuestions((prev) => prev.filter((q) => q.section_id !== section.id));
    await fetch(`/api/admin/questionnaires/sections/${section.id}`, { method: "DELETE" });
    setPendingDeleteSection(null);
    if (activeTab === section.id) {
      const remaining = ordered.filter((s) => s.id !== section.id);
      setActiveTab(remaining[idx]?.id ?? remaining[idx - 1]?.id ?? "opening");
    }
    bumpPreview();
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
    bumpPreview();
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
    bumpPreview();
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
    bumpPreview();
  }

  async function handleDeleteQuestion(question: QuestionRow) {
    setQuestions((prev) => prev.filter((q) => q.id !== question.id));
    await fetch(`/api/admin/questionnaires/questions/${question.id}`, { method: "DELETE" });
    setPendingDeleteQuestion(null);
    bumpPreview();
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
  const activeSection = orderedSections.find((s) => s.id === activeTab) ?? null;
  const previewSrc = `/portal/questionnaire/preview/${templateId}?r=${previewNonce}`;

  return (
    <>
      <PageHeader
        title={template.title}
        subtitle="Questionnaire"
        action={
          <div className="flex items-center gap-2">
            <a href={`/portal/questionnaire/preview/${templateId}`} target="_blank" rel="noreferrer">
              <Button variant="secondary" size="sm">
                Preview <ExternalLink size={13} />
              </Button>
            </a>
            {activeTab === "opening" ? (
              <Button variant="primary" size="sm" onClick={handleSaveOpening} disabled={savingOpening}>
                {savingOpening ? "Saving..." : "Save changes"}
              </Button>
            ) : (
              <p className="hidden text-xs text-muted sm:block">Saved automatically</p>
            )}
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

      <div className="grid gap-6 p-6 xl:grid-cols-[minmax(0,640px)_400px] xl:items-start">
        <div className="flex flex-col gap-4">
          {error && <p className="text-sm text-status-declined">{error}</p>}

          <div className="flex flex-wrap items-center gap-1.5" role="tablist">
            <TabPill active={activeTab === "opening"} onClick={() => setActiveTab("opening")}>
              Opening Screen
            </TabPill>
            {orderedSections.map((s) => (
              <TabPill key={s.id} active={activeTab === s.id} onClick={() => setActiveTab(s.id)} badge={questions.filter((q) => q.section_id === s.id).length}>
                {s.title}
              </TabPill>
            ))}
            <button
              onClick={handleAddSection}
              aria-label="Add chapter"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-dashed border-gold/40 text-gold transition-colors hover:bg-gold/10"
            >
              <Plus size={16} />
            </button>
          </div>

          {activeTab === "opening" ? (
            <GlassCard className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <MessageSquareText size={18} className="shrink-0 text-gold" />
                <div>
                  <p className="text-sm font-semibold">Opening Screen</p>
                  <p className="text-xs text-muted">The first thing your client sees before the questions start.</p>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={labelClass}>Heading</span>
                  <input value={openingHeading} onChange={(e) => setOpeningHeading(e.target.value)} className={inputClass} />
                </label>
                <label className="block">
                  <span className={labelClass}>Button Label</span>
                  <input value={openingCta} onChange={(e) => setOpeningCta(e.target.value)} className={inputClass} />
                </label>
              </div>
              <label className="block">
                <span className={labelClass}>Body</span>
                <textarea value={openingBody} onChange={(e) => setOpeningBody(e.target.value)} className={cn(inputClass, "min-h-[56px]")} />
              </label>
              {saved && <p className="text-xs text-status-approved">Saved.</p>}
            </GlassCard>
          ) : activeSection ? (
            <SectionPanel
              key={activeSection.id}
              section={activeSection}
              questions={questions.filter((q) => q.section_id === activeSection.id).sort((a, b) => a.position - b.position)}
              priorQuestions={priorQuestions}
              onUpdateSection={(updates) => handleUpdateSection(activeSection, updates)}
              onMoveSection={(dir) => handleMoveSection(activeSection, dir)}
              onDeleteSection={() => setPendingDeleteSection(activeSection)}
              onAddQuestion={() => handleAddQuestion(activeSection)}
              onUpdateQuestion={handleUpdateQuestion}
              onMoveQuestion={handleMoveQuestion}
              onDeleteQuestion={setPendingDeleteQuestion}
            />
          ) : null}
        </div>

        <div className="xl:sticky xl:top-6">
          <GlassCard className="overflow-hidden !p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="text-sm font-semibold">Client preview</p>
              <div className="flex items-center gap-1">
                <button onClick={bumpPreview} aria-label="Refresh preview" className="rounded-md p-1.5 text-muted hover:bg-black/5 hover:text-foreground">
                  <RefreshCw size={14} />
                </button>
                <div className="ml-1 flex rounded-full border border-border bg-panel p-0.5">
                  <button
                    onClick={() => setPreviewDevice("desktop")}
                    aria-label="Desktop preview"
                    className={cn("flex h-7 w-8 items-center justify-center rounded-full", previewDevice === "desktop" ? "bg-[#161616] text-white" : "text-muted")}
                  >
                    <Monitor size={13} />
                  </button>
                  <button
                    onClick={() => setPreviewDevice("mobile")}
                    aria-label="Mobile preview"
                    className={cn("flex h-7 w-8 items-center justify-center rounded-full", previewDevice === "mobile" ? "bg-[#161616] text-white" : "text-muted")}
                  >
                    <Smartphone size={13} />
                  </button>
                </div>
              </div>
            </div>
            <div className="flex justify-center bg-panel/60 p-3">
              <iframe
                key={previewNonce}
                src={previewSrc}
                title="Client preview"
                className={cn("h-[640px] rounded-[10px] border border-border bg-background transition-[width]", previewDevice === "mobile" ? "w-[360px]" : "w-full")}
              />
            </div>
          </GlassCard>
        </div>
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

function TabPill({
  active,
  onClick,
  badge,
  children
}: {
  active: boolean;
  onClick: () => void;
  badge?: number;
  children: React.ReactNode;
}) {
  return (
    <button
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
        active ? "bg-[#161616] text-white" : "bg-panel text-muted hover:text-foreground"
      )}
    >
      {children}
      {typeof badge === "number" && (
        <span
          className={cn(
            "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold",
            active ? "bg-gold text-[#1A140A]" : "bg-black/10 text-muted"
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

function OverflowMenu({ items }: { items: { label: string; onClick: () => void; danger?: boolean }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        className="rounded-md p-1.5 text-muted transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <>
          <button aria-hidden tabIndex={-1} className="fixed inset-0 z-10 cursor-default" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[150px] rounded-[10px] border border-border bg-card py-1 shadow-lg">
            {items.map((item) => (
              <button
                key={item.label}
                onClick={() => {
                  item.onClick();
                  setOpen(false);
                }}
                className={cn(
                  "block w-full px-3 py-1.5 text-left text-xs font-medium hover:bg-black/5",
                  item.danger ? "text-status-declined" : "text-foreground"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SectionPanel({
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
  const [editingTitle, setEditingTitle] = useState(false);

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          {editingTitle ? (
            <input
              autoFocus
              value={section.title}
              onChange={(e) => onUpdateSection({ title: e.target.value })}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => e.key === "Enter" && setEditingTitle(false)}
              className="w-full border-none bg-transparent text-sm font-semibold outline-none"
            />
          ) : (
            <button onClick={() => setEditingTitle(true)} className="text-left text-sm font-semibold hover:underline">
              {section.title}
            </button>
          )}
          <p className="mt-0.5 text-xs text-muted">
            {questions.length} question{questions.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setEditingTransition((v) => !v)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted hover:text-gold"
          >
            <Pencil size={12} /> Edit transition
          </button>
          <OverflowMenu
            items={[
              { label: "Move chapter up", onClick: () => onMoveSection(-1) },
              { label: "Move chapter down", onClick: () => onMoveSection(1) },
              { label: "Delete chapter", onClick: onDeleteSection, danger: true }
            ]}
          />
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
        {questions.map((q, i) => (
          <QuestionEditor
            key={q.id}
            position={i + 1}
            question={q}
            priorQuestions={priorQuestions(q.id)}
            onUpdate={(updates) => onUpdateQuestion(q, updates)}
            onMove={(dir) => onMoveQuestion(q, dir)}
            onDelete={() => onDeleteQuestion(q)}
          />
        ))}
        <button onClick={onAddQuestion} className="flex w-fit items-center gap-1.5 text-xs font-medium text-muted hover:text-gold">
          <Plus size={13} /> Add question
        </button>
      </div>
    </GlassCard>
  );
}

function QuestionEditor({
  position,
  question,
  priorQuestions,
  onUpdate,
  onMove,
  onDelete
}: {
  position: number;
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
      <div className="flex items-center gap-3">
        <GripVertical size={15} className="shrink-0 cursor-grab text-muted/50" aria-hidden />
        <span className="flex h-5 w-6 shrink-0 items-center justify-center rounded-full bg-gold-soft text-[10px] font-semibold text-gold-dim">
          {String(position).padStart(2, "0")}
        </span>
        <button onClick={() => setExpanded((v) => !v)} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-medium">{question.prompt}</p>
          {question.depends_on_question_key && (
            <p className="mt-0.5 truncate text-xs text-muted">Depends on &ldquo;{dependsOnQuestion?.prompt ?? question.depends_on_question_key}&rdquo;</p>
          )}
        </button>

        <select
          value={question.question_type}
          onChange={(e) => onUpdate({ question_type: e.target.value as QuestionType })}
          className={pillSelectClass}
        >
          {Object.entries(QUESTION_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>

        <label className="flex shrink-0 items-center gap-1.5">
          <ToggleSwitch checked={question.required} onChange={(v) => onUpdate({ required: v })} label="Required" />
          <span className="hidden text-xs text-muted sm:inline">Required</span>
        </label>

        <OverflowMenu
          items={[
            { label: "Move up", onClick: () => onMove(-1) },
            { label: "Move down", onClick: () => onMove(1) },
            { label: "Delete question", onClick: onDelete, danger: true }
          ]}
        />

        <button onClick={() => setExpanded((v) => !v)} className="shrink-0 p-1 text-muted hover:text-foreground" aria-label={expanded ? "Collapse" : "Expand"}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-3 border-t border-black/10 pt-3">
          <label className="block">
            <span className={labelClass}>Question</span>
            <input value={question.prompt} onChange={(e) => onUpdate({ prompt: e.target.value })} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Subtext (optional)</span>
            <input value={question.subtext ?? ""} onChange={(e) => onUpdate({ subtext: e.target.value })} className={inputClass} />
          </label>

          {HAS_OPTIONS.includes(question.question_type) && (
            <div>
              <span className={labelClass}>Options</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {question.options.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <GripVertical size={14} className="shrink-0 cursor-grab text-muted/40" aria-hidden />
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
              </div>
              <button onClick={addOption} className="mt-2 flex w-fit items-center gap-1.5 text-xs font-medium text-muted hover:text-gold">
                <Plus size={13} /> Add option
              </button>
            </div>
          )}

          <label className="flex items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={question.allow_unsure} onChange={(e) => onUpdate({ allow_unsure: e.target.checked })} />
            Allow &ldquo;I&rsquo;ll decide later&rdquo;
          </label>

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
