/** Undo/redo for the editor. Consecutive changes with the same key (one drag, one typing burst) count as one step. */

export type History<T> = { past: T[]; present: T; future: T[]; lastKey: string | null; lastAt: number };

export const HISTORY_LIMIT = 100;

export function initHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], lastKey: null, lastAt: 0 };
}

export function commit<T>(h: History<T>, next: T, key: string | null = null, now = Date.now(), mergeMs = 900): History<T> {
  if (next === h.present) return h;
  const merge = key !== null && key === h.lastKey && now - h.lastAt < mergeMs && h.past.length > 0;
  const past = merge ? h.past : [...h.past, h.present].slice(-HISTORY_LIMIT);
  return { past, present: next, future: [], lastKey: key, lastAt: now };
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h;
  const prev = h.past[h.past.length - 1];
  return { past: h.past.slice(0, -1), present: prev, future: [h.present, ...h.future], lastKey: null, lastAt: 0 };
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h;
  const [next, ...rest] = h.future;
  return { past: [...h.past, h.present], present: next, future: rest, lastKey: null, lastAt: 0 };
}
