import { describe, expect, it } from "vitest";
import { newImage, newText } from "@/lib/flyers/scene";
import type { Scene } from "@/lib/flyers/types";
import { applyRaster, burstAt, type Pixels, type RasterOp } from "@/lib/flyers/motion/raster";
import { evaluateFrame, frameCount, frameTime } from "@/lib/flyers/motion/engine";
import { presetFits, PRESET_BY_ID } from "@/lib/flyers/motion/presets";
import { emptyAnimation, type Animation } from "@/lib/flyers/motion/types";
import { newItem } from "@/lib/flyers/motion/recipes";

/** A 20×10 picture: an opaque cream square in the middle of a transparent field (a cutout). */
function cutout(): Pixels {
  const w = 20, h = 10;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 2; y < 8; y++)
    for (let x = 6; x < 14; x++) {
      const i = (y * w + x) * 4;
      data.set([240, 230, 200, 255], i);
    }
  return { data, width: w, height: h };
}
const alphaAt = (p: Pixels, x: number, y: number) => p.data[(y * p.width + x) * 4 + 3];

describe("pixel ops keep transparency clean", () => {
  it("noise, grain, scanlines, exposure and shine never paint transparent pixels", () => {
    const ops: RasterOp[] = [
      { kind: "noise", amount: 0.5, seed: 3, mono: false },
      { kind: "noise", amount: 0.5, seed: 4, mono: true },
      { kind: "scan", alpha: 0.5, spacing: 2, offset: 1 },
      { kind: "exposure", gain: 1.15 },
      { kind: "shine", pos: 0.5, width: 0.5, angle: 0, alpha: 1, color: [255, 255, 255] }
    ];
    const p = cutout();
    applyRaster(p, ops, 1);
    for (let y = 0; y < p.height; y++)
      for (let x = 0; x < p.width; x++) {
        const inside = x >= 6 && x < 14 && y >= 2 && y < 8;
        expect(alphaAt(p, x, y)).toBe(inside ? 255 : 0);
      }
  });
  it("RGB split leaves only coloured fringes next to the shape, never a box", () => {
    const p = cutout();
    applyRaster(p, [{ kind: "rgb", rdx: 2, rdy: 0, bdx: -2, bdy: 0 }], 1);
    // Far from the shape: still fully transparent.
    expect(alphaAt(p, 0, 0)).toBe(0);
    expect(alphaAt(p, 19, 9)).toBe(0);
    expect(alphaAt(p, 10, 0)).toBe(0);
    // Right fringe is red only, left fringe blue only.
    const right = (5 * 20 + 15) * 4;
    expect([p.data[right], p.data[right + 1], p.data[right + 2]]).toEqual([240, 0, 0]);
    const left = (5 * 20 + 4) * 4;
    expect([p.data[left], p.data[left + 1], p.data[left + 2]]).toEqual([0, 0, 200]);
  });
  it("slices move rows sideways and uncover transparency (not black)", () => {
    const p = cutout();
    applyRaster(p, [{ kind: "slices", bands: [{ y0: 0.2, y1: 0.5, dx: 4 }] }], 1);
    expect(alphaAt(p, 6, 3)).toBe(0); // moved away
    expect(alphaAt(p, 17, 3)).toBe(255); // moved here
    expect(alphaAt(p, 6, 6)).toBe(255); // rows outside the band untouched
  });
  it("sizes are in flyer pixels: a half-size preview moves half as many pixels", () => {
    const a = cutout();
    applyRaster(a, [{ kind: "slices", bands: [{ y0: 0, y1: 1, dx: 4 }] }], 0.5);
    expect(alphaAt(a, 6, 4)).toBe(0);
    expect(alphaAt(a, 15, 4)).toBe(255);
    expect(alphaAt(a, 16, 4)).toBe(0);
  });
  it("masked reveal: 0 hides, 1 shows, and it only ever lowers alpha", () => {
    const hidden = cutout();
    applyRaster(hidden, [{ kind: "wipe", amount: 0, dir: "right", soft: 0.1 }], 1);
    expect(Math.max(...Array.from({ length: 200 }, (_, i) => hidden.data[i * 4 + 3]))).toBe(0);
    const shown = cutout();
    applyRaster(shown, [{ kind: "wipe", amount: 1, dir: "right", soft: 0.1 }], 1);
    expect(shown.data).toEqual(cutout().data);
    const half = cutout();
    applyRaster(half, [{ kind: "wipe", amount: 0.5, dir: "right", soft: 0.05 }], 1);
    expect(alphaAt(half, 7, 4)).toBe(255);
    expect(alphaAt(half, 13, 4)).toBe(0);
  });
  it("the same ops on the same pixels give the same frame", () => {
    const ops: RasterOp[] = [{ kind: "noise", amount: 0.3, seed: 9, mono: false }, { kind: "rowwave", y0: 0, y1: 1, amp: 3, freq: 2, phase: 0.2 }];
    const a = cutout();
    const b = cutout();
    applyRaster(a, ops, 1);
    applyRaster(b, ops, 1);
    expect(a.data).toEqual(b.data);
  });
});

describe("glitch schedules", () => {
  it("bursts never touch the loop point and repeat identically", () => {
    for (let seed = 0; seed < 50; seed++) {
      for (const count of [1, 2, 3, 6]) {
        expect(burstAt(0, seed, count, 0.05)).toBeNull();
        expect(burstAt(0.9999, seed, count, 0.05)).toBeNull();
        expect(burstAt(0.37, seed, count, 0.05)).toEqual(burstAt(0.37, seed, count, 0.05));
      }
    }
  });
  it("there are exactly `count` bursts per loop", () => {
    for (const count of [1, 3, 5]) {
      let bursts = 0;
      let on = false;
      for (let i = 0; i < 2400; i++) {
        const b = burstAt(i / 2400, 11, count, 0.04);
        if (b && !on) bursts++;
        on = !!b;
      }
      expect(bursts).toBe(count);
    }
  });
});

const S = { width: 1080, height: 1920 };
function scene(): Scene {
  return {
    version: 1, format: "story", width: 1080, height: 1920, background: "#000", safeMargin: 40,
    nodes: [
      newImage("background", { type: "static", src: "/bg.jpg" }, S, { id: "bg" } as never),
      newText("title", S, { id: "title", text: "BLACKOUT", x: 90, y: 900, width: 900, height: 170 } as never),
      newText("venue", S, { id: "venue", text: "{{venue.name|NORTH 48}}", x: 90, y: 100, width: 900, height: 170 } as never),
      newImage("portrait", { type: "dj_photo", slot: 1 }, S, { id: "photo", x: 200, y: 600, width: 680, height: 900 } as never)
    ]
  };
}
const animWith = (id: string, preset: string): Animation => ({ ...emptyAnimation(), readableLock: true, layers: { [id]: { stack: [newItem(preset, { strength: 0.8 })] } } });
const kinds = (a: Animation, id: string, t: number) => (evaluateFrame(scene(), a, t).get(id)?.raster ?? []).map((r) => r.kind);
/** The op kinds a preset uses anywhere in the loop. */
function usedKinds(preset: string, id = "title") {
  const a = animWith(id, preset);
  const all = new Set<string>();
  for (let i = 0; i < frameCount(a); i++) kinds(a, id, frameTime(a, i)).forEach((k) => all.add(k));
  return all;
}

describe("the three glitches behave differently", () => {
  it("Digital Slice cuts slices; RGB Signal bends rows and splits channels; Analog VHS is a steady tape look", () => {
    const slice = usedKinds("fx.digital-slice");
    const signal = usedKinds("fx.rgb-signal");
    const vhs = usedKinds("fx.vhs");
    expect(slice.has("slices")).toBe(true);
    expect(signal.has("slices")).toBe(false);
    expect(signal.has("rowwave") && signal.has("rgb") && signal.has("exposure")).toBe(true);
    expect(vhs.has("scan") && vhs.has("noise")).toBe(true);
    // VHS is on all the time; the other two are clean between bursts (and at the seam).
    const v = animWith("title", "fx.vhs");
    expect(kinds(v, "title", 0)).toContain("scan");
    for (const p of ["fx.digital-slice", "fx.rgb-signal"]) {
      const a = animWith("title", p);
      expect(kinds(a, "title", 0)).toEqual([]);
      expect(kinds(a, "title", frameTime(a, frameCount(a) - 1))).toEqual([]);
    }
  });
  it("glitches stay off protected event details while the lock is on", () => {
    for (const p of ["fx.digital-slice", "fx.rgb-signal", "fx.vhs"]) {
      const venue = scene().nodes.find((n) => n.id === "venue")!;
      expect(presetFits(PRESET_BY_ID.get(p)!, venue, "venue", true)).not.toBe(true);
      expect(presetFits(PRESET_BY_ID.get(p)!, venue, "venue", false)).toBe(true);
    }
  });
  it("faces move less: the DJ photo's slices are capped at 3% of its width", () => {
    const a = animWith("photo", "fx.digital-slice");
    let worst = 0;
    for (let i = 0; i < frameCount(a); i++)
      for (const r of evaluateFrame(scene(), a, frameTime(a, i)).get("photo")?.raster ?? []) if (r.kind === "slices") for (const b of r.bands) worst = Math.max(worst, Math.abs(b.dx));
    expect(worst).toBeGreaterThan(0);
    expect(worst).toBeLessThanOrEqual(680 * 0.03 + 1e-9);
  });
});
