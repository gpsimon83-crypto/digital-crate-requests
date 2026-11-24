import type { FlyerNode, Scene } from "../types";
import { IDENTITY, MAX_STACK, type Animation, type Intensity, type MotionItem, type MotionState } from "./types";
import { PRESET_BY_ID, clamp, isProtected, presetFits, roleOf } from "./presets";

/**
 * The loop engine. Everything is a function of timeline time t (seconds),
 * never of the wall clock: frame i of N is t = i / fps, for i = 0 … N−1
 * (the t = duration endpoint is frame 0 again and is never exported).
 */

export const INTENSITY: Record<Intensity, number> = { subtle: 0.6, balanced: 1, high: 1.5 };

export function frameCount(a: Pick<Animation, "duration" | "fps">) {
  return Math.round(a.duration * a.fps);
}
export function frameTime(a: Pick<Animation, "fps">, i: number) {
  return i / a.fps;
}

const frac = (x: number) => x - Math.floor(x);

/** Which layers animate: with any layer soloed, only soloed ones; muted ones never. */
function liveLayers(anim: Animation) {
  const solo = Object.values(anim.layers).some((l) => l.solo && l.stack.length);
  return (id: string) => {
    const l = anim.layers[id];
    if (!l || !l.stack.length || l.muted) return false;
    return solo ? !!l.solo : true;
  };
}

export function evaluateItem(item: MotionItem, node: FlyerNode, ctx: { t: number; anim: Animation; scene: Scene; reduced: boolean; role: FlyerNode["role"]; state: MotionState }) {
  const p = PRESET_BY_ID.get(item.preset);
  if (!p) return;
  const lock = ctx.anim.readableLock;
  if (presetFits(p, node, ctx.role, lock) !== true) return;
  const cycles = Math.max(1, Math.round(item.cycles || 1));
  const loopU = frac(ctx.t / ctx.anim.duration);
  const u = frac(cycles * loopU + (item.phase || 0));
  const mul = INTENSITY[ctx.anim.intensity] * (ctx.reduced ? 0.35 : 1);
  p.apply(ctx.state, {
    u,
    loopU,
    cycles,
    amount: clamp((item.strength ?? 0.25) * mul, 0, 1),
    item,
    node,
    locked: lock && isProtected(node, ctx.role),
    scene: { width: ctx.scene.width, height: ctx.scene.height, safeMargin: ctx.scene.safeMargin },
    reduced: ctx.reduced
  });
}

/** Every animated layer's offsets at time t. Layers without motion aren't in the map. */
export function evaluateFrame(scene: Scene, anim: Animation | null | undefined, t: number, opts: { reduced?: boolean } = {}): Map<string, MotionState> {
  const out = new Map<string, MotionState>();
  if (!anim || !anim.enabled) return out;
  const live = liveLayers(anim);
  for (const node of scene.nodes) {
    if (!node.visible || !live(node.id)) continue;
    const l = anim.layers[node.id];
    const state: MotionState = { ...IDENTITY, overlays: [] };
    for (const item of l.stack.slice(0, MAX_STACK)) evaluateItem(item, node, { t, anim, scene, reduced: !!opts.reduced, role: roleOf(node, l.role), state });
    out.set(node.id, state);
  }
  return out;
}

/** A layer's state as numbers, for comparing frames. */
function vector(s: MotionState): number[] {
  const v = [s.dx, s.dy, s.scale, s.rotate, s.opacity, s.inner?.scale ?? 1, s.inner?.dx ?? 0, s.inner?.dy ?? 0, s.reveal?.amount ?? 1, s.trackingEm, s.shadow?.dx ?? 0, s.shadow?.dy ?? 0];
  for (const o of s.overlays) {
    if (o.kind === "particles") for (const p of o.items) v.push(p.x, p.y, p.a);
    else if (o.kind === "sweep") v.push(o.pos > 1.2 || o.pos < -0.2 ? 0 : o.alpha, o.alpha > 0.001 ? o.pos : 0);
    else v.push(o.alpha);
  }
  return v;
}
const scaleOf = (i: number) => (i === 2 || i === 4 || i === 5 || i === 8 ? 100 : 1); // ratios in %, others in px

export type LoopReport = { ok: boolean; frames: number; issues: { nodeId: string; name: string; what: string; jump: number }[] };

/**
 * Compares the last frame with the first, and the step across the seam
 * with an ordinary step, for every animated layer. A big jump at the seam
 * is reported. This catches parameter discontinuities; it can't promise a
 * perfect loop, so the side-by-side frames and the repeated playback stay.
 */
export function checkLoop(scene: Scene, anim: Animation): LoopReport {
  const N = frameCount(anim);
  const dt = 1 / anim.fps;
  const last = evaluateFrame(scene, anim, (N - 1) * dt);
  const first = evaluateFrame(scene, anim, 0);
  const second = evaluateFrame(scene, anim, dt);
  const issues: LoopReport["issues"] = [];
  for (const [id, a] of last) {
    const b = first.get(id);
    const c = second.get(id);
    if (!b || !c) continue;
    const va = vector(a), vb = vector(b), vc = vector(c);
    let worst = 0;
    for (let i = 0; i < Math.min(va.length, vb.length); i++) {
      const seam = Math.abs(vb[i] - va[i]) * scaleOf(i);
      const step = Math.abs(vc[i] - vb[i]) * scaleOf(i);
      // A seam step much bigger than a normal step (and big in absolute terms) is a visible jump.
      const jump = seam - Math.max(step * 3, 2);
      if (jump > worst) worst = jump;
    }
    if (va.length !== vb.length) worst = Math.max(worst, 10);
    if (worst > 0) issues.push({ nodeId: id, name: scene.nodes.find((n) => n.id === id)?.name ?? id, what: "changes suddenly between the last and first frame", jump: Math.round(worst * 10) / 10 });
  }
  return { ok: issues.length === 0, frames: N, issues };
}
