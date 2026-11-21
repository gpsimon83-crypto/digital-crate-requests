/**
 * Runs Photo Effects in a Web Worker (falls back to the main thread when
 * workers aren't available). Results come back as canvases ready to draw.
 */
import { applyEffects, type PhotoEffects, type Pixels } from "@/lib/flyers/effects";

let worker: Worker | null | undefined;
let nextId = 1;
const waiting = new Map<number, (r: { out?: Pixels; error?: string; missing?: boolean }) => void>();
const sent = new Set<string>();

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    worker = new Worker(new URL("./fx-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (e) => {
      const cb = waiting.get(e.data.id);
      waiting.delete(e.data.id);
      cb?.(e.data);
    };
    worker.onerror = () => {
      // Worker broke: finish what's waiting on the main thread from now on.
      worker = null;
      for (const cb of waiting.values()) cb({ error: "retry" });
      waiting.clear();
    };
  } catch {
    worker = null;
  }
  return worker;
}

const keys = new WeakMap<HTMLCanvasElement, string>();
let keyN = 0;
/** A stable id for a source canvas (so the worker can keep it between slider moves). */
export function keyFor(c: HTMLCanvasElement) {
  let k = keys.get(c);
  if (!k) keys.set(c, (k = `src${++keyN}`));
  return k;
}

function pixelsOf(c: HTMLCanvasElement): Pixels {
  const d = c.getContext("2d", { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height);
  return { data: d.data, width: d.width, height: d.height };
}

export function toCanvas(p: Pixels): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = p.width;
  c.height = p.height;
  c.getContext("2d")!.putImageData(new ImageData(new Uint8ClampedArray(p.data), p.width, p.height), 0, 0);
  return c;
}

/** Effects for a source canvas at `scale` output pixels per flyer pixel. */
export async function runEffects(src: HTMLCanvasElement, fx: PhotoEffects, scale: number): Promise<HTMLCanvasElement> {
  const w = getWorker();
  const key = keyFor(src);
  if (w) {
    const attempt = (withSrc: boolean) =>
      new Promise<{ out?: Pixels; error?: string; missing?: boolean }>((resolve) => {
        const id = nextId++;
        waiting.set(id, resolve);
        const msg: Record<string, unknown> = { id, key, fx, scale };
        if (withSrc) msg.src = pixelsOf(src);
        w.postMessage(msg);
      });
    let r = await attempt(!sent.has(key));
    sent.add(key);
    if (r.missing) r = await attempt(true);
    if (r.out) return toCanvas(r.out);
    if (r.error && r.error !== "retry") throw new Error(r.error);
  }
  return toCanvas(applyEffects(pixelsOf(src), fx, scale));
}
