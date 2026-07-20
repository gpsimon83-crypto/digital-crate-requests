"use client";

// Fixed categorical hue order (dark-surface steps), CVD-ordered — never
// reassigned per-render, never cycled. Slot 8 ("Other") is reserved for
// folding a long tail so the token ceiling (7-8) is never exceeded.
const CATEGORICAL_HUES = [
  "#3987e5", // blue
  "#199e70", // aqua
  "#c98500", // yellow
  "#008300", // green
  "#9085e9", // violet
  "#e66767", // red
  "#d55181", // magenta
  "#898781", // "Other" — muted, not a hue slot
];

export interface StackedBarSegment {
  label: string;
  value: number;
}

const MAX_SEGMENTS = 7; // beyond this the tail folds into "Other"
const BAR_HEIGHT = 22; // px, within the ≤24px mark spec
const GAP = 2; // px surface gap between touching segments

/** Horizontal stacked bar for part-to-whole data (every track has exactly
 * one genre/era/energy level) — one bar, categorical segments in fixed hue
 * order, legend below since this is ≥2 series. Long tails fold into
 * "Other" rather than generating a 9th hue. */
export function StackedBarChart({ segments, unit = "songs" }: { segments: StackedBarSegment[]; unit?: string }) {
  const sorted = [...segments].sort((a, b) => b.value - a.value);
  const head = sorted.slice(0, MAX_SEGMENTS);
  const tail = sorted.slice(MAX_SEGMENTS);
  const otherValue = tail.reduce((sum, s) => sum + s.value, 0);
  const shown = otherValue > 0 ? [...head, { label: "Other", value: otherValue }] : head;

  const total = shown.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex h-[22px] w-full overflow-hidden rounded-md" style={{ gap: `${GAP}px`, height: BAR_HEIGHT }}>
        {shown.map((s, i) => {
          const pct = (s.value / total) * 100;
          const color = CATEGORICAL_HUES[i] ?? CATEGORICAL_HUES[CATEGORICAL_HUES.length - 1];
          const showInlineLabel = pct >= 12; // only label a segment if the text will actually fit
          return (
            <div
              key={s.label}
              title={`${s.label}: ${s.value} ${unit} (${Math.round(pct)}%)`}
              className="flex h-full items-center justify-center overflow-hidden first:rounded-l-md last:rounded-r-md"
              style={{ width: `${pct}%`, backgroundColor: color, minWidth: pct > 0 ? "2px" : 0 }}
            >
              {showInlineLabel && (
                <span className="truncate px-1 text-[10px] font-semibold text-black/80">{Math.round(pct)}%</span>
              )}
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {shown.map((s, i) => {
          const color = CATEGORICAL_HUES[i] ?? CATEGORICAL_HUES[CATEGORICAL_HUES.length - 1];
          return (
            <span key={s.label} className="flex items-center gap-1.5 text-[11px] text-muted">
              <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
              {s.label} <span className="text-muted/70">({s.value})</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
