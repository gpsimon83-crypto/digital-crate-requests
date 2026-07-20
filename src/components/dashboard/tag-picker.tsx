"use client";

/** Reusable pill multi-select. `multi=false` behaves as a single-select
 * (clicking a pill replaces the selection instead of toggling it on top). */
export function TagPicker({
  options,
  selected,
  onChange,
  multi = true,
}: {
  options: readonly string[];
  selected: string[];
  onChange: (values: string[]) => void;
  multi?: boolean;
}) {
  function toggle(option: string) {
    if (!multi) {
      onChange(selected[0] === option ? [] : [option]);
      return;
    }
    onChange(selected.includes(option) ? selected.filter((v) => v !== option) : [...selected, option]);
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const active = selected.includes(option);
        return (
          <button
            key={option}
            type="button"
            onClick={() => toggle(option)}
            className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${
              active
                ? "border-gold bg-gold/15 text-gold"
                : "border-white/12 text-muted hover:border-white/25 hover:text-foreground"
            }`}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
