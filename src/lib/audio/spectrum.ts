/**
 * Turns analyser frequency data into a fixed number of bars for the player's
 * visualizer. Pure functions (no DOM), shared logic with the members-area
 * player (digitalcratedjs.com) so both look and behave the same.
 *
 * - Bars are spaced logarithmically (40 Hz – 16 kHz) so bass doesn't fill the display.
 * - A gentle tilt lifts the quieter highs; a soft knee keeps peaks from clipping.
 * - Smoothing has a fast attack and a slower release, frame-rate independent.
 */

export type Band = [start: number, end: number];

/** Log-spaced bin ranges for `count` bars. Every bar covers at least one bin; ranges never go backwards. */
export function bandBins(count: number, binCount: number, sampleRate: number, fMin = 40, fMax = 16000): Band[] {
  const nyquist = sampleRate / 2;
  const hi = Math.min(fMax, nyquist * 0.98);
  const binHz = nyquist / binCount;
  const bands: Band[] = [];
  let prevEnd = Math.max(1, Math.floor(fMin / binHz));
  for (let i = 0; i < count; i++) {
    const f1 = fMin * Math.pow(hi / fMin, (i + 1) / count);
    let end = Math.min(binCount, Math.max(prevEnd + 1, Math.round(f1 / binHz)));
    const start = Math.min(prevEnd, binCount - 1);
    if (end <= start) end = Math.min(binCount, start + 1);
    bands.push([start, end]);
    prevEnd = end;
  }
  return bands;
}

const KNEE = 1.8;
const KNEE_NORM = 1 - Math.exp(-KNEE);

/** Target levels (0–1) for each band from byte frequency data (0–255). */
export function bandLevels(data: ArrayLike<number>, bands: Band[], out: Float32Array): Float32Array {
  const n = bands.length;
  for (let i = 0; i < n; i++) {
    const [s, e] = bands[i];
    let peak = 0;
    let sum = 0;
    for (let b = s; b < e; b++) {
      const v = data[b] ?? 0;
      sum += v;
      if (v > peak) peak = v;
    }
    // Mix of peak and mean: wide (high) bands don't look flat, narrow (low) bands don't spike.
    const raw = (0.6 * peak + 0.4 * (sum / Math.max(1, e - s))) / 255;
    const tilt = 0.82 + 0.42 * (i / Math.max(1, n - 1));
    const x = Math.max(0, raw * tilt - 0.04);
    // Soft knee: approaches 1 smoothly instead of clipping.
    out[i] = Math.min(0.98, (1 - Math.exp(-KNEE * x)) / KNEE_NORM);
  }
  return out;
}

/** Moves `cur` toward `target`: fast up (attack), slower down (release). `dt` is seconds since the last frame. */
export function smoothLevels(cur: Float32Array, target: Float32Array, dt: number, attack = 0.55, release = 0.12): Float32Array {
  const frames = Math.min(4, Math.max(0, dt * 60));
  const up = 1 - Math.pow(1 - attack, frames);
  const down = 1 - Math.pow(1 - release, frames);
  for (let i = 0; i < cur.length; i++) {
    const t = target[i] ?? 0;
    cur[i] += (t - cur[i]) * (t > cur[i] ? up : down);
    if (cur[i] < 0.0005) cur[i] = 0;
  }
  return cur;
}

/** How many bars fit a width (thin bars, 64–96 on desktop, fewer on small screens). */
export function barCountFor(width: number): number {
  return Math.max(36, Math.min(96, Math.round(width / 7)));
}

/** "3:07"; "--:--" for unknown or endless durations. */
export function fmtTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return "--:--";
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
}
