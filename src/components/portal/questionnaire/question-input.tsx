"use client";

import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import type { AnswerValue, PersonListEntry, Question } from "@/lib/questionnaire-engine";

const inputClass =
  "w-full rounded-[10px] border border-black/10 bg-panel px-4 py-3 text-base focus:border-gold focus:outline-none";

interface QuestionInputProps {
  question: Question;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
  onSelectAdvance?: (value: string) => void;
}

export function QuestionInput({ question, value, onChange, onSelectAdvance }: QuestionInputProps) {
  const stringValue = value && !("unsure" in value) && typeof value.value === "string" ? value.value : "";
  const arrayValue = value && !("unsure" in value) && Array.isArray(value.value) ? (value.value as string[]) : [];
  const personValue =
    value && !("unsure" in value) && Array.isArray(value.value) && value.value.length > 0 && typeof value.value[0] === "object"
      ? (value.value as unknown as PersonListEntry[])
      : [];

  switch (question.question_type) {
    case "single_select":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {question.options.map((opt) => {
            const selected = stringValue === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  if (onSelectAdvance) onSelectAdvance(opt.value);
                  else onChange({ value: opt.value });
                }}
                className={cn(
                  "rounded-[10px] border px-5 py-4 text-left text-sm font-medium transition-colors",
                  selected ? "border-gold bg-gold/10 text-gold" : "border-black/10 bg-panel hover:border-gold/50"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );

    case "multi_select":
      return (
        <div className="grid gap-3 sm:grid-cols-2">
          {question.options.map((opt) => {
            const selected = arrayValue.includes(opt.value);
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  const next = selected ? arrayValue.filter((v) => v !== opt.value) : [...arrayValue, opt.value];
                  onChange({ value: next });
                }}
                className={cn(
                  "rounded-[10px] border px-5 py-4 text-left text-sm font-medium transition-colors",
                  selected ? "border-gold bg-gold/10 text-gold" : "border-black/10 bg-panel hover:border-gold/50"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );

    case "short_text":
    case "song":
      return (
        <input
          value={stringValue}
          onChange={(e) => onChange({ value: e.target.value })}
          placeholder={question.question_type === "song" ? "Song title — Artist" : undefined}
          className={inputClass}
          autoFocus
        />
      );

    case "time":
      return <input type="time" value={stringValue} onChange={(e) => onChange({ value: e.target.value })} className={inputClass} />;

    case "long_text":
      return (
        <textarea
          value={stringValue}
          onChange={(e) => onChange({ value: e.target.value })}
          className={cn(inputClass, "min-h-[140px]")}
          autoFocus
        />
      );

    case "person_list":
      return <PersonListInput entries={personValue} onChange={(entries) => onChange({ value: entries })} />;

    default:
      return null;
  }
}

function PersonListInput({ entries, onChange }: { entries: PersonListEntry[]; onChange: (entries: PersonListEntry[]) => void }) {
  const rows = entries.length > 0 ? entries : [{ name: "", role: "" }];

  function update(i: number, key: keyof PersonListEntry, val: string) {
    const next = rows.map((r, idx) => (idx === i ? { ...r, [key]: val } : r));
    onChange(next);
  }

  function remove(i: number) {
    onChange(rows.filter((_, idx) => idx !== i));
  }

  return (
    <div className="flex flex-col gap-3">
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={row.name}
            onChange={(e) => update(i, "name", e.target.value)}
            placeholder="Name"
            className={cn(inputClass, "flex-1")}
          />
          <input
            value={row.role}
            onChange={(e) => update(i, "role", e.target.value)}
            placeholder="Role (Best Man, Reader...)"
            className={cn(inputClass, "flex-1")}
          />
          {rows.length > 1 && (
            <button type="button" onClick={() => remove(i)} className="text-muted hover:text-status-declined">
              <X size={16} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...rows, { name: "", role: "" }])}
        className="flex w-fit items-center gap-1.5 rounded-[10px] border border-black/10 px-3 py-2 text-xs font-medium hover:border-gold"
      >
        <Plus size={13} /> Add another
      </button>
    </div>
  );
}
