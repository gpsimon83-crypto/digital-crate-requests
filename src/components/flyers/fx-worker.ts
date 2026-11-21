/// <reference lib="webworker" />
/**
 * Photo Effects off the main thread. Keeps the last few source pictures so
 * moving a slider only re-runs the effects, not the transfer of the photo.
 */
import { applyEffects, type PhotoEffects, type Pixels } from "@/lib/flyers/effects";

const cache = new Map<string, Pixels>();
type Msg = { id: number; key: string; src?: Pixels; fx: PhotoEffects; scale: number };

self.onmessage = (e: MessageEvent<Msg>) => {
  const { id, key, src, fx, scale } = e.data;
  try {
    if (src) {
      cache.delete(key);
      cache.set(key, src);
      while (cache.size > 8) cache.delete(cache.keys().next().value as string);
    }
    const base = cache.get(key);
    if (!base) return (self as unknown as Worker).postMessage({ id, missing: true });
    const out = applyEffects(base, fx, scale);
    (self as unknown as Worker).postMessage({ id, out }, [out.data.buffer]);
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: err instanceof Error ? err.message : "Effects failed" });
  }
};
