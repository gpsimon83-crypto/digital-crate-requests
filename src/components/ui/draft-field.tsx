"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Like Field, but for values that get reformatted from parent state
 * (e.g. cents round-tripped to a dollar string) — committing on every
 * keystroke fights the user typing (a trailing "." gets stripped the
 * instant it's typed, making decimals impossible to enter). This keeps
 * a local draft while focused and only calls onCommit on blur/Enter.
 */
export function DraftField({
  label,
  value,
  onCommit,
  type = "text",
  placeholder
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setDraft(value);
  }, [value]);

  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</span>
      <input
        type={type}
        value={draft}
        placeholder={placeholder}
        onFocus={() => {
          focused.current = true;
        }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          focused.current = false;
          onCommit(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
      />
    </label>
  );
}
