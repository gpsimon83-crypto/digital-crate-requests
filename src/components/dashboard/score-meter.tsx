"use client";

// Same three bands used everywhere a score/severity is shown in this app
// (approved/gold/declined) — a status job, not a categorical one.
function bandColor(score: number): string {
  if (score >= 80) return "var(--status-approved)";
  if (score >= 55) return "var(--gold)";
  return "var(--status-declined)";
}

/** Meter — "a single ratio against a limit." Fill carries severity; the
 * unfilled track is a dim step of the surface, so state reads across the
 * whole ring at a glance. */
export function ScoreMeter({ value, size = 64 }: { value: number; size?: number }) {
  const stroke = Math.max(4, Math.round(size / 10));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);
  const color = bandColor(value);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(33,31,26,0.1)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-sm font-bold" style={{ color }}>{value}</span>
      </div>
    </div>
  );
}
