import type { FlyerNode, Scene } from "../types";
import { IDENTITY, MAX_KEYS, MAX_SPEED_POINTS, MAX_STACK, type Animation, type Intensity, type Keyframe, type LayerMotion, type MotionItem, type MotionState, type SpeedPoint } from "./types";
import { PRESET_BY_ID, clamp, isProtected, optsFor, presetFits, roleOf } from "./presets";

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

/* ---------------- beats, markers and triggers ---------------- */

/** The beat grid: BPM nudged so a whole number of beats fills the loop (so beats line up every repeat). */
export function beatGrid(anim: Pick<Animation, "duration" | "bpm">) {
  if (!anim.bpm || !(anim.bpm.bpm > 0)) return null;
  const beats = Math.max(1, Math.round((anim.duration * anim.bpm.bpm) / 60));
  const period = anim.duration / beats;
  return { beats, period, bpm: (beats * 60) / anim.duration, offset: ((anim.bpm.offset % period) + period) % period };
}

/** The moments (seconds) an effect with a trigger fires, within one loop. */
export function triggerTimes(anim: Animation, item: MotionItem): number[] {
  const tr = item.trigger;
  if (!tr) return [];
  if (tr.on === "markers") return (anim.markers ?? []).map((m) => m.t);
  const g = beatGrid(anim);
  if (!g) return [];
  const every = Math.max(1, Math.round(tr.every || 1));
  const out: number[] = [];
  for (let b = 0; b < g.beats; b += every) out.push(g.offset + b * g.period);
  return out;
}

/** Which trigger is playing at t (wrapping round the loop), and how far through it (0..1). */
export function triggerAt(anim: Animation, item: MotionItem, t: number): { k: number; local: number } | null {
  const tr = item.trigger!;
  const times = triggerTimes(anim, item);
  const D = anim.duration;
  const len = Math.max(1 / anim.fps, Math.min(D, tr.length || 0.5));
  let best: { k: number; local: number } | null = null;
  times.forEach((tm, k) => {
    const since = (((t - tm - (tr.offset || 0)) % D) + D) % D;
    if (since < len && (!best || since / len < best.local)) best = { k, local: since / len };
  });
  return best;
}

/* ---------------- speed ramps ---------------- */

/**
 * A layer's own clock with a speed ramp: speed points joined by straight lines
 * (wrapping round the loop; 0 = frozen). The ramp is normalised so a loop
 * still takes exactly one loop, so ramped motion always closes. Exact
 * (piecewise integration), so scrubbing and export always agree.
 */
export function remapTime(points: SpeedPoint[] | undefined, t: number, D: number) {
  if (!points?.length) return t;
  const ps = [...points]
    .slice(0, MAX_SPEED_POINTS)
    .map((p) => ({ t: clamp(p.t, 0, D), speed: clamp(p.speed, 0, 4) }))
    .sort((a, b) => a.t - b.t);
  // Speed at any time: straight lines between points, wrapping from the last to the first.
  const pts = [{ t: ps[ps.length - 1].t - D, speed: ps[ps.length - 1].speed }, ...ps, { t: ps[0].t + D, speed: ps[0].speed }];
  const integral = (x: number) => {
    // Area under the speed line from 0 to x (0 ≤ x ≤ D).
    let acc = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      const lo = Math.max(0, a.t), hi = Math.min(x, b.t);
      if (hi <= lo) continue;
      const at = (v: number) => a.speed + ((b.speed - a.speed) * (v - a.t)) / (b.t - a.t || 1);
      acc += ((at(lo) + at(hi)) / 2) * (hi - lo);
    }
    return acc;
  };
  const total = integral(D);
  if (total <= 1e-9) return 0; // frozen the whole loop
  const tt = ((t % D) + D) % D;
  return (integral(tt) / total) * D;
}

const hasMotion = (l: LayerMotion | undefined) => !!l && (l.stack.length > 0 || (l.keys?.length ?? 0) > 0 || !!l.window || !!l.hidden || (l.blur ?? 0) > 0);

/** Which layers animate: with any layer soloed, only soloed ones; muted ones never. */
function liveLayers(anim: Animation) {
  const solo = Object.values(anim.layers).some((l) => l.solo && hasMotion(l));
  return (id: string) => {
    const l = anim.layers[id];
    if (!hasMotion(l) || l.muted) return false;
    return solo ? !!l.solo : true;
  };
}

const KEY_FIELDS = ["dx", "dy", "scale", "rotate", "opacity", "fx"] as const;
const smooth = (x: number) => 0.5 - 0.5 * Math.cos(Math.PI * x);

/** Keyframed values at time t, wrapping from the last keyframe back to the first. */
export function keyValues(keys: Keyframe[] | undefined, t: number, duration: number): Omit<Keyframe, "id" | "t" | "easing"> | null {
  if (!keys?.length) return null;
  const ks = [...keys].sort((a, b) => a.t - b.t).slice(0, MAX_KEYS);
  if (ks.length === 1) return { dx: ks[0].dx, dy: ks[0].dy, scale: ks[0].scale, rotate: ks[0].rotate, opacity: ks[0].opacity, fx: ks[0].fx };
  const tt = ((t % duration) + duration) % duration;
  let i = ks.findIndex((k) => k.t > tt) - 1;
  if (i === -2) i = ks.length - 1; // after the last key
  if (i === -1) i = ks.length - 1; // before the first key: still travelling from the last one
  const a = ks[i];
  const b = ks[(i + 1) % ks.length];
  const ta = a.t;
  let tb = b.t;
  let x = tt;
  if (tb <= ta) {
    tb += duration;
    if (x < ta) x += duration;
  }
  const span = tb - ta || duration;
  let u = Math.min(1, Math.max(0, (x - ta) / span));
  if (a.easing === "easeInOut") u = smooth(u);
  const out = {} as Record<(typeof KEY_FIELDS)[number], number>;
  for (const f of KEY_FIELDS) out[f] = a[f] + (b[f] - a[f]) * u;
  return out;
}

/** Is the layer inside its on-screen window at t? (A window may wrap past the loop point.) */
export function inWindow(w: LayerMotion["window"], t: number, duration: number) {
  if (!w) return true;
  const s = Math.max(0, Math.min(duration, w.start));
  const e = Math.max(0, Math.min(duration, w.end));
  if (e - s >= duration - 1e-9 || s === e) return true;
  return s < e ? t >= s && t < e : t >= s || t < e;
}

/** Share of the loop a window covers. */
export function windowCover(w: LayerMotion["window"], duration: number) {
  if (!w) return 1;
  const s = Math.max(0, Math.min(duration, w.start));
  const e = Math.max(0, Math.min(duration, w.end));
  if (s === e) return 1;
  return (s < e ? e - s : duration - s + e) / duration;
}

export function evaluateItem(item: MotionItem, node: FlyerNode, ctx: { t: number; anim: Animation; scene: Scene; reduced: boolean; role: FlyerNode["role"]; state: MotionState; fxMul?: number; realT?: number }) {
  const p = PRESET_BY_ID.get(item.preset);
  if (!p) return;
  const lock = ctx.anim.readableLock;
  if (presetFits(p, node, ctx.role, lock) !== true) return;
  let cycles = Math.max(1, Math.round(item.cycles || 1));
  const loopU = frac(ctx.t / ctx.anim.duration);
  let raw = frac(cycles * loopU + (item.phase || 0));
  // On beat markers / the beat grid: idle between triggers, one full cycle per trigger.
  let burst: { k: number; local: number } | null | undefined;
  if (item.trigger) {
    // Triggers follow the timeline (beats), not the layer's ramped clock.
    const tr = triggerAt(ctx.anim, item, ctx.realT ?? ctx.t);
    if (!tr) return;
    raw = Math.min(0.999999, tr.local);
    burst = tr;
    cycles = 1;
  }
  // Ping-pong: forward over the first half of each cycle, back over the second.
  const u = item.loop === "pingpong" ? Math.min(0.999999, raw < 0.5 ? 2 * raw : 2 - 2 * raw) : raw;
  const mul = INTENSITY[ctx.anim.intensity] * (ctx.reduced ? 0.35 : 1) * (ctx.fxMul ?? 1);
  p.apply(ctx.state, {
    u,
    loopU,
    cycles,
    amount: clamp((item.strength ?? 0.25) * mul, 0, 1),
    item,
    node,
    locked: lock && isProtected(node, ctx.role),
    scene: { width: ctx.scene.width, height: ctx.scene.height, safeMargin: ctx.scene.safeMargin },
    reduced: ctx.reduced,
    duration: ctx.anim.duration,
    fps: ctx.anim.fps,
    role: ctx.role,
    burst,
    opts: optsFor(p, item)
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
    const role = roleOf(node, l.role);
    const state: MotionState = { ...IDENTITY, overlays: [], raster: [] };
    const protectedLayer = anim.readableLock && isProtected(node, role);
    // Hidden in the video, or outside its on-screen window. Protected event details
    // stay on screen unless their window still covers most (80%) of the loop.
    const offWindow = !inWindow(l.window, t, anim.duration) && !(protectedLayer && windowCover(l.window, anim.duration) < 0.8);
    if ((l.hidden && !protectedLayer) || offWindow) {
      state.opacity = 0;
      out.set(node.id, state);
      continue;
    }
    // The layer's own clock (speed ramp / freeze), then its motion at that moment.
    const lt = remapTime(l.speed, t, anim.duration);
    layerAt(node, l, lt, state, { anim, scene, reduced: !!opts.reduced, role, protectedLayer, realT: t });
    // Motion blur: smear along how far the layer moves around this frame.
    const blur = clamp(l.blur ?? 0, 0, 1);
    if (blur > 0) {
      const h = (blur * 0.5) / anim.fps;
      const a0 = { ...IDENTITY, overlays: [], raster: [] } as MotionState;
      const a1 = { ...IDENTITY, overlays: [], raster: [] } as MotionState;
      layerAt(node, l, remapTime(l.speed, t - h, anim.duration), a0, { anim, scene, reduced: !!opts.reduced, role, protectedLayer, realT: t - h });
      layerAt(node, l, remapTime(l.speed, t + h, anim.duration), a1, { anim, scene, reduced: !!opts.reduced, role, protectedLayer, realT: t + h });
      const dx = (a1.dx - a0.dx) * 2;
      const dy = (a1.dy - a0.dy) * 2;
      // Ignore the jump across the loop point of a layer that pops (it would smear the whole layer).
      if (Math.hypot(dx, dy) > 0.5 && Math.hypot(dx, dy) < 400) state.raster.push({ kind: "mblur", dx: dx / state.scale, dy: dy / state.scale });
    }
    out.set(node.id, state);
  }
  return out;
}

/** Keyframes (the layer's own path), then its effects on top, at the layer's time `t`. */
function layerAt(node: FlyerNode, l: LayerMotion, t: number, state: MotionState, c: { anim: Animation; scene: Scene; reduced: boolean; role: FlyerNode["role"]; protectedLayer: boolean; realT: number }) {
  const k = keyValues(l.keys, t, c.anim.duration);
  let fxMul = 1;
  if (k) {
    const cap = c.protectedLayer ? 24 : Infinity; // event details move at most 24 px with the lock on
    state.dx += clamp(k.dx, -cap, cap);
    state.dy += clamp(k.dy, -cap, cap);
    state.scale *= c.protectedLayer ? clamp(k.scale, 0.9, 1.1) : clamp(k.scale, 0.05, 8);
    state.rotate += c.protectedLayer ? clamp(k.rotate, -6, 6) : k.rotate;
    state.opacity *= c.protectedLayer ? Math.max(0.85, clamp(k.opacity, 0, 1)) : clamp(k.opacity, 0, 1);
    fxMul = clamp(k.fx, 0, 1);
  }
  for (const item of l.stack.slice(0, MAX_STACK)) evaluateItem(item, node, { t, anim: c.anim, scene: c.scene, reduced: c.reduced, role: c.role, state, fxMul, realT: c.realT });
}

/** A layer's state as numbers, for comparing frames. */
function vector(s: MotionState): number[] {
  const v = [s.dx, s.dy, s.scale, s.rotate, s.opacity, s.inner?.scale ?? 1, s.inner?.dx ?? 0, s.inner?.dy ?? 0, s.reveal?.amount ?? 1, s.trackingEm, s.shadow?.dx ?? 0, s.shadow?.dy ?? 0];
  for (const o of s.overlays) {
    if (o.kind === "particles") for (const p of o.items) v.push(p.x, p.y, p.a);
    else if (o.kind === "sweep") v.push(o.pos > 1.2 || o.pos < -0.2 ? 0 : o.alpha, o.alpha > 0.001 ? o.pos : 0);
    else v.push(o.alpha);
  }
  // Pixel effects: how strong each kind is, in fixed slots (an op that's absent counts as 0).
  // Noise patterns and scroll positions aren't compared.
  const KINDS = ["slices", "rgb", "rowwave", "scan", "noise", "exposure", "shine", "wipe", "refract", "double", "mblur"] as const;
  const fx = new Array<number>(KINDS.length).fill(0);
  fx[7] = 100; // fully shown when there's no wipe
  for (const r of s.raster) {
    if (r.kind === "slices") fx[0] += r.bands.reduce((m, b) => m + Math.abs(b.dx), 0);
    else if (r.kind === "rgb") fx[1] += Math.abs(r.rdx) + Math.abs(r.bdx);
    else if (r.kind === "rowwave") fx[2] += Math.abs(r.amp);
    else if (r.kind === "scan") fx[3] += r.alpha * 100;
    else if (r.kind === "noise") fx[4] += r.amount * 100;
    else if (r.kind === "exposure") fx[5] += (r.gain - 1) * 100;
    else if (r.kind === "shine") fx[6] += r.pos > 1.2 || r.pos < -0.2 ? 0 : r.alpha * 100;
    else if (r.kind === "wipe") fx[7] = Math.min(fx[7], r.amount * 100);
    else if (r.kind === "refract") fx[8] += (Math.abs(r.disp) + Math.abs(r.disperse)) * (r.window ? (r.window.centre + r.window.width / 2 > 1e-6 && r.window.centre - r.window.width / 2 < 1 - 1e-6 ? 1 : 0) : 1);
    else if (r.kind === "double") fx[9] += r.opacity * 100 + r.scale * 50 + r.oy * 50;
    else if (r.kind === "mblur") fx[10] += Math.hypot(r.dx, r.dy);
  }
  v.push(...fx);
  return v;
}
const scaleOf = (i: number) => (i === 2 || i === 4 || i === 5 || i === 8 ? 100 : 1); // ratios in %, others in px

export type LoopReport = { ok: boolean; frames: number; issues: { nodeId: string; name: string; what: string; jump: number; fix: string }[] };

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
    if (worst > 0) {
      const l = anim.layers[id];
      const lastT = (N - 1) * dt;
      const fix =
        l && inWindow(l.window, lastT, anim.duration) !== inWindow(l.window, 0, anim.duration)
          ? "Its on-screen bar starts or ends at the loop point, so it pops on or off there. Drag that end of the bar in a little (or across the whole loop), or fade it with keyframes."
          : "One of its effects doesn't return to where it started. Use a whole number of cycles, set its start offset to 0, or pick a ping-pong style effect.";
      issues.push({ nodeId: id, name: scene.nodes.find((n) => n.id === id)?.name ?? id, what: "changes suddenly between the last and first frame", jump: Math.round(worst * 10) / 10, fix });
    }
  }
  return { ok: issues.length === 0, frames: N, issues };
}
