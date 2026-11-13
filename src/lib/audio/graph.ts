/**
 * One shared AudioContext for the page, and at most one MediaElementAudioSourceNode
 * per <audio> element (the browser allows only one; a second throws). The element
 * is routed source → analyser → destination, so playback stays audible.
 *
 * If Web Audio isn't available (or the context can't be created), callers get
 * null and the audio element keeps playing on its own: the visualizer falls back.
 */

type Graph = { ctx: AudioContext; analyser: AnalyserNode };

let shared: AudioContext | null = null;
const graphs = new WeakMap<HTMLMediaElement, Graph>();

function context(): AudioContext | null {
  if (shared) return shared;
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    shared = new AC();
  } catch {
    shared = null;
  }
  return shared;
}

/** Connects the element once and returns its analyser. Call from a user gesture (play) so the context can resume. */
export function analyserFor(el: HTMLMediaElement): AnalyserNode | null {
  const existing = graphs.get(el);
  if (existing) {
    if (existing.ctx.state === "suspended") void existing.ctx.resume().catch(() => {});
    return existing.analyser;
  }
  const ctx = context();
  if (!ctx) return null;
  try {
    const source = ctx.createMediaElementSource(el);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0.55;
    analyser.minDecibels = -90;
    analyser.maxDecibels = -14;
    source.connect(analyser);
    analyser.connect(ctx.destination);
    graphs.set(el, { ctx, analyser });
    if (ctx.state === "suspended") void ctx.resume().catch(() => {});
    return analyser;
  } catch {
    return null;
  }
}
