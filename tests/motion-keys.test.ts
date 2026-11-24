import { describe, expect, it } from "vitest";
import { newText } from "@/lib/flyers/scene";
import type { Scene } from "@/lib/flyers/types";
import { checkLoop, evaluateFrame, inWindow, keyValues } from "@/lib/flyers/motion/engine";
import { emptyAnimation, type Animation, type Keyframe } from "@/lib/flyers/motion/types";
import { parseAnimation } from "@/lib/flyers/motion/schema";

const k = (t: number, p: Partial<Keyframe> = {}): Keyframe => ({ id: `k${t}`, t, dx: 0, dy: 0, scale: 1, rotate: 0, opacity: 1, fx: 1, easing: "linear", ...p });
const S = { width: 1080, height: 1920 };
const scene = (): Scene => ({
  version: 1, format: "story", width: 1080, height: 1920, background: "#000", safeMargin: 40,
  nodes: [newText("title", S, { id: "title", text: "BLACKOUT", x: 90, y: 900, width: 900, height: 170 } as never), newText("venue", S, { id: "venue", text: "{{venue.name|NORTH 48}}", x: 90, y: 100, width: 900, height: 170 } as never)]
});

describe("keyframes", () => {
  it("interpolate between keys and run on from the last key to the first", () => {
    const keys = [k(0, { dx: 0 }), k(2, { dx: 100 }), k(6, { dx: -100 })];
    expect(keyValues(keys, 1, 8)!.dx).toBeCloseTo(50);
    expect(keyValues(keys, 4, 8)!.dx).toBeCloseTo(0);
    // 6 → 8(=0): from −100 back to 0
    expect(keyValues(keys, 7, 8)!.dx).toBeCloseTo(-50);
    expect(keyValues(keys, 8, 8)).toEqual(keyValues(keys, 0, 8));
  });
  it("a loop that doesn't start with a key still closes", () => {
    const keys = [k(2, { dy: 40 }), k(5, { dy: -40 })];
    expect(keyValues(keys, 0, 8)).toEqual(keyValues(keys, 8, 8));
    expect(keyValues(keys, 0.5, 8)!.dy).toBeCloseTo(-40 + 80 * (3.5 / 5));
  });
  it("keyframed layers pass the loop check, and eased keys too", () => {
    const anim: Animation = { ...emptyAnimation(), layers: { title: { stack: [], keys: [k(0, { dx: 0, easing: "easeInOut" }), k(4, { dx: 60, scale: 1.1, easing: "easeInOut" })] } } };
    expect(checkLoop(scene(), anim).ok).toBe(true);
    expect(evaluateFrame(scene(), anim, 4).get("title")!.dx).toBeCloseTo(60);
  });
  it("the readable lock limits keyframes on event details", () => {
    const anim: Animation = { ...emptyAnimation(), layers: { venue: { stack: [], keys: [k(0, { dx: 500, opacity: 0, scale: 3 })] } } };
    const st = evaluateFrame(scene(), anim, 1).get("venue")!;
    expect(st.dx).toBe(24);
    expect(st.opacity).toBeGreaterThanOrEqual(0.85);
    expect(st.scale).toBe(1.1);
    const free = evaluateFrame(scene(), { ...anim, readableLock: false }, 1).get("venue")!;
    expect([free.dx, free.opacity, free.scale]).toEqual([500, 0, 3]);
  });
});

describe("on-screen window", () => {
  it("hides the layer outside its window, including windows that wrap the loop point", () => {
    expect(inWindow({ start: 2, end: 6 }, 1, 8)).toBe(false);
    expect(inWindow({ start: 2, end: 6 }, 3, 8)).toBe(true);
    expect(inWindow({ start: 6, end: 2 }, 7, 8)).toBe(true);
    expect(inWindow({ start: 6, end: 2 }, 1, 8)).toBe(true);
    expect(inWindow({ start: 6, end: 2 }, 4, 8)).toBe(false);
    const anim: Animation = { ...emptyAnimation(), layers: { title: { stack: [], window: { start: 2, end: 6 } } } };
    expect(evaluateFrame(scene(), anim, 1).get("title")!.opacity).toBe(0);
    expect(evaluateFrame(scene(), anim, 3).get("title")!.opacity).toBe(1);
  });
  it("event details stay on screen unless their window covers 80% of the loop", () => {
    const short: Animation = { ...emptyAnimation(), layers: { venue: { stack: [], window: { start: 2, end: 6 } } } };
    expect(evaluateFrame(scene(), short, 1).get("venue")!.opacity).toBe(1);
    const hidden: Animation = { ...emptyAnimation(), layers: { venue: { stack: [], hidden: true } } };
    expect(evaluateFrame(scene(), hidden, 1).get("venue")!.opacity).toBe(1);
  });
  it("a window that pops the layer on at the loop point is reported by the loop check", () => {
    const anim: Animation = { ...emptyAnimation(), layers: { title: { stack: [], window: { start: 0, end: 4 } } } };
    expect(checkLoop(scene(), anim).ok).toBe(false);
  });
});

describe("saved settings", () => {
  it("keyframes, windows, visibility and lock survive a save and reopen", () => {
    const anim: Animation = { ...emptyAnimation(), layers: { title: { stack: [], keys: [k(0), k(2.5, { dx: 30, easing: "easeInOut" })], window: { start: 1, end: 7 }, hidden: false, locked: true } } };
    const back = parseAnimation(JSON.parse(JSON.stringify(anim)));
    expect(back).toEqual({ ok: true, value: anim });
  });
});

describe("loop mode", () => {
  it("ping-pong makes any effect close the loop smoothly", () => {
    const anim: Animation = { ...emptyAnimation(), layers: { title: { stack: [{ id: "a", preset: "text.slide", strength: 0.5, cycles: 1, phase: 0.3, easing: "linear", direction: "up", loop: "pingpong" }] } } };
    expect(checkLoop(scene(), anim).ok).toBe(true);
    // Halfway through the cycle it turns back: the frames either side match.
    const a = evaluateFrame(scene(), anim, 3.99).get("title")!.dy;
    const b = evaluateFrame(scene(), anim, 4.01).get("title")!.dy;
    expect(Math.abs(a - b)).toBeLessThan(2);
  });
});
