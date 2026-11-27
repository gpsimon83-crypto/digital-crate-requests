import { describe, expect, it } from "vitest";
import { newImage, newText } from "@/lib/flyers/scene";
import type { Scene } from "@/lib/flyers/types";
import { applyRaster, RASTER_IMAGES, type Pixels } from "@/lib/flyers/motion/raster";
import { beatGrid, checkLoop, evaluateFrame, frameCount, frameTime, remapTime, triggerAt } from "@/lib/flyers/motion/engine";
import { MOTION_PRESETS, PRESET_BY_ID, optsFor, presetFits } from "@/lib/flyers/motion/presets";
import { parseAnimation } from "@/lib/flyers/motion/schema";
import { newItem } from "@/lib/flyers/motion/recipes";
import { emptyAnimation, type Animation, type MotionItem } from "@/lib/flyers/motion/types";

const S = { width: 1080, height: 1350 };
function scene(): Scene {
  return {
    version: 1, format: "portrait", width: 1080, height: 1350, background: "#000", safeMargin: 40,
    nodes: [
      newImage("background", { type: "static", src: "/bg.jpg" }, S, { id: "bg" } as never),
      newText("title", S, { id: "title", text: "DJ NIGHT", x: 90, y: 200, width: 900, height: 200 } as never),
      newImage("portrait", { type: "static", src: "/flyers/sample/portraits/dj-01.png" }, S, { id: "dj", x: 140, y: 300, width: 800, height: 1000 } as never),
      newText("venue", S, { id: "venue", text: "{{venue.name|NORTH 48}}", x: 90, y: 60, width: 900, height: 120 } as never)
    ]
  };
}
const withItem = (id: string, it: MotionItem, extra: Partial<Animation> = {}): Animation => ({ ...emptyAnimation(), layers: { [id]: { stack: [it] } }, ...extra });

/** A 20×10 cutout: an opaque square in a transparent field. */
function cutout(): Pixels {
  const w = 20, h = 10;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 2; y < 8; y++) for (let x = 6; x < 14; x++) data.set([200, 120, 80, 255], (y * w + x) * 4);
  return { data, width: w, height: h };
}
const alphaAt = (p: Pixels, x: number, y: number) => p.data[(y * p.width + x) * 4 + 3];

describe("reference IDs from the design library", () => {
  it("Controlled Glitch, Film Grain and VHS Scanlines open the effects that already do that", () => {
    expect(PRESET_BY_ID.get("text.glitch")!.id).toBe("fx.digital-slice");
    expect(PRESET_BY_ID.get("photos.grain")!.id).toBe("fx.grain");
    expect(PRESET_BY_ID.get("overlays.vhs")!.id).toBe("fx.vhs");
    // Saved with a reference ID: still valid, and it renders.
    const a = withItem("title", { ...newItem("fx.vhs"), preset: "overlays.vhs" });
    expect(parseAnimation(JSON.parse(JSON.stringify(a))).ok).toBe(true);
    expect(evaluateFrame(scene(), { ...a, readableLock: false }, 1).get("title")!.raster.length).toBeGreaterThan(0);
  });
});

describe("old flyers render exactly as before", () => {
  it("a VHS effect saved before tracking controls existed keeps its old look (no jitter, full tears)", () => {
    const old: MotionItem = { id: "v1", preset: "fx.vhs", strength: 0.5, cycles: 1, phase: 0, easing: "linear", seed: 7 };
    const o = optsFor(PRESET_BY_ID.get("fx.vhs")!, old);
    expect(o).toEqual({ rolls: 2, jitter: 0, tear: 1 });
    // A new VHS effect gets the new, subtle defaults.
    expect(newItem("fx.vhs").opts).toEqual({ rolls: 2, jitter: 0.15, tear: 0.5 });
    // Old: only the original op kinds, no jitter slices beyond the head-switch band.
    const st = evaluateFrame(scene(), { ...withItem("bg", old), readableLock: false }, 1.3).get("bg")!;
    expect(st.raster.filter((r) => r.kind === "slices")).toHaveLength(1);
  });
  it("flyers saved without markers, BPM, speed ramps or blur still parse and evaluate", () => {
    const a = withItem("title", { id: "a", preset: "text.pulse", strength: 0.5, cycles: 2, phase: 0, easing: "easeInOut" });
    const p = parseAnimation(JSON.parse(JSON.stringify(a)));
    expect(p.ok && p.value).toEqual(a);
  });
});

describe("every effect still loops cleanly, including the new ones", () => {
  for (const p of MOTION_PRESETS.filter((x) => ["photos.rgb-slice", "photos.refraction", "overlays.prism", "overlays.burn", "photos.double", "text.occlude", "fx.vhs"].includes(x.id))) {
    it(p.id, () => {
      const target = p.id === "text.occlude" ? "title" : p.id === "overlays.burn" ? "bg" : "dj";
      const it = newItem(p.id);
      if (p.needs === "occluder") it.opts = { ...it.opts, occluder: "dj" };
      const a = { ...withItem(target, it), readableLock: false };
      expect(presetFits(p, scene().nodes.find((n) => n.id === target)!, target === "bg" ? "background" : target === "dj" ? "portrait" : "title", false)).toBe(true);
      expect(checkLoop(scene(), a).ok).toBe(true);
      // Something happens somewhere in the loop.
      let seen = false;
      for (let i = 0; i < frameCount(a) && !seen; i += 4) {
        const st = evaluateFrame(scene(), a, frameTime(a, i)).get(target)!;
        seen = st.raster.length > 0 || st.overlays.length > 0 || Math.abs(st.dx) > 1 || !!st.occlude;
      }
      expect(seen).toBe(true);
    });
  }
});

describe("new effects behave as described", () => {
  it("RGB Slice Glitch is one short burst, clean at the loop point", () => {
    const a = { ...withItem("dj", newItem("photos.rgb-slice")), readableLock: false };
    let on = 0;
    for (let i = 0; i < frameCount(a); i++) if (evaluateFrame(scene(), a, frameTime(a, i)).get("dj")!.raster.length) on++;
    expect(on).toBeGreaterThan(0);
    expect(on).toBeLessThanOrEqual(Math.ceil(0.45 * 30) + 1); // ≈ one 0.45 s burst per 8 s loop
    expect(evaluateFrame(scene(), a, 0).get("dj")!.raster).toEqual([]);
  });
  it("glitch, refraction and occlusion stay off event details while the lock is on", () => {
    const venue = scene().nodes.find((n) => n.id === "venue")!;
    for (const id of ["photos.rgb-slice", "photos.refraction", "overlays.prism", "text.occlude"]) expect(presetFits(PRESET_BY_ID.get(id)!, venue, "venue", true)).not.toBe(true);
    // Film Burn never goes on text (it sits on pictures / the background, under the text).
    expect(presetFits(PRESET_BY_ID.get("overlays.burn")!, venue, "venue", false)).not.toBe(true);
  });
  it("Occlusion Reveal slides the text out and names the layer it hides behind", () => {
    const it = newItem("text.occlude");
    it.opts = { ...it.opts, occluder: "dj" };
    const a = { ...withItem("title", it), readableLock: false };
    const hidden = evaluateFrame(scene(), a, 0).get("title")!;
    const out = evaluateFrame(scene(), a, 4).get("title")!;
    expect(hidden.occlude).toEqual({ nodeId: "dj", soft: 6 });
    expect(Math.abs(hidden.dx)).toBeGreaterThan(100); // starts tucked behind
    expect(Math.abs(out.dx)).toBeLessThan(1); // fully out at rest
  });
  it("Double Exposure blends only inside the silhouette and spares the face", () => {
    RASTER_IMAGES.set("/test/crowd.png", { data: new Uint8ClampedArray(4 * 4 * 4).fill(255), width: 4, height: 4 });
    const p = cutout();
    applyRaster(p, [{ kind: "double", src: "/test/crowd.png", box: { x: 0, y: 0, w: 20, h: 10 }, blend: "screen", opacity: 1, scale: 1, ox: 0, oy: 0, feather: 0, face: { x: 0.35, y: 0.5, size: 0.12, amount: 1 } }], 1);
    expect(alphaAt(p, 0, 0)).toBe(0); // outside stays transparent
    expect(p.data[(5 * 20 + 12) * 4]).toBe(255); // inside: screened toward white
    expect(p.data[(5 * 20 + 7) * 4]).toBeLessThan(255); // the "face" spot keeps more of the portrait
  });
  it("Refraction bends pixels inside the layer and keeps transparency clean", () => {
    const p = cutout();
    applyRaster(p, [{ kind: "refract", angle: 0, band: 8, disp: 2, disperse: 0, pos: 0 }], 1);
    expect(alphaAt(p, 0, 0)).toBe(0);
    expect(alphaAt(p, 19, 9)).toBe(0);
    expect(p.data).not.toEqual(cutout().data);
  });
  it("motion blur smears along the movement without dark fringes", () => {
    const p = cutout();
    applyRaster(p, [{ kind: "mblur", dx: 6, dy: 0 }], 1);
    const i = (5 * 20 + 15) * 4;
    expect(p.data[i + 3]).toBeGreaterThan(0); // smeared past the old edge
    expect(p.data[i]).toBe(200); // same colour, just more transparent (no darkening)
  });
});

describe("beat markers, BPM grid and triggers", () => {
  it("the BPM is nudged so a whole number of beats fills the loop", () => {
    const g = beatGrid({ duration: 8, bpm: { bpm: 126, offset: 0, show: true } })!;
    expect(g.beats).toBe(17);
    expect(g.period * g.beats).toBeCloseTo(8);
    expect(beatGrid({ duration: 8, bpm: { bpm: 120, offset: 0, show: true } })!.bpm).toBe(120);
  });
  it("an effect on markers fires on each marker and idles in between, on silent flyers", () => {
    const it = { ...newItem("text.pulse"), trigger: { on: "markers" as const, every: 1, offset: 0, length: 0.5 } };
    const a = { ...withItem("title", it), markers: [{ id: "m1", t: 1 }, { id: "m2", t: 5 }] };
    expect(evaluateFrame(scene(), a, 0.5).get("title")!.scale).toBe(1);
    expect(evaluateFrame(scene(), a, 1.25).get("title")!.scale).toBeGreaterThan(1);
    expect(evaluateFrame(scene(), a, 3).get("title")!.scale).toBe(1);
    expect(evaluateFrame(scene(), a, 5.25).get("title")!.scale).toBeGreaterThan(1);
    expect(triggerAt(a, it, 5.25)).toEqual({ k: 1, local: 0.5 });
  });
  it("offsets shift the trigger, and a trigger near the end wraps into the start (the loop closes)", () => {
    const it = { ...newItem("text.pulse"), trigger: { on: "markers" as const, every: 1, offset: 0.2, length: 0.6 } };
    const a = { ...withItem("title", it), markers: [{ id: "m", t: 7.8 }] };
    expect(triggerAt(a, it, 7.9)).toBeNull(); // offset: not yet
    expect(triggerAt(a, it, 0.2)!.local).toBeCloseTo(0.2 / 0.6);
    expect(checkLoop(scene(), a).ok).toBe(true);
  });
  it("glitches on the beat grid burst on every Nth beat", () => {
    const it = { ...newItem("photos.rgb-slice"), trigger: { on: "beats" as const, every: 4, offset: 0, length: 0.2 } };
    const a = { ...withItem("dj", it), readableLock: false, bpm: { bpm: 120, offset: 0, show: true } };
    const on = (t: number) => evaluateFrame(scene(), a, t).get("dj")!.raster.length > 0;
    expect(on(0.1)).toBe(true); // beat 0
    expect(on(0.6)).toBe(false); // beat 1 (not every 4th)
    expect(on(2.1)).toBe(true); // beat 4
  });
});

describe("speed ramps, freezes and motion blur", () => {
  it("a ramp keeps the loop length, and a freeze holds the layer still", () => {
    const pts = [{ t: 2, speed: 1 }, { t: 2.2, speed: 0 }, { t: 3.2, speed: 0 }, { t: 3.4, speed: 1 }];
    expect(remapTime(pts, 0, 8)).toBe(0);
    expect(remapTime(pts, 7.9999, 8)).toBeCloseTo(8, 2);
    expect(remapTime(pts, 2.5, 8)).toBeCloseTo(remapTime(pts, 3.0, 8), 6); // frozen
    expect(remapTime(undefined, 3.3, 8)).toBe(3.3);
    // Deterministic: the same time always maps the same.
    expect(remapTime(pts, 5.123, 8)).toBe(remapTime(pts, 5.123, 8));
  });
  it("the layer's motion follows its ramp, and still loops cleanly", () => {
    const a: Animation = { ...emptyAnimation(), layers: { dj: { stack: [{ ...newItem("photos.float"), strength: 0.8 }], speed: [{ t: 2, speed: 1 }, { t: 2.2, speed: 0 }, { t: 3.2, speed: 0 }, { t: 3.4, speed: 1 }] } } };
    const s1 = evaluateFrame(scene(), a, 2.5).get("dj")!;
    const s2 = evaluateFrame(scene(), a, 3.0).get("dj")!;
    expect(s1.dy).toBeCloseTo(s2.dy, 6);
    expect(checkLoop(scene(), a).ok).toBe(true);
  });
  it("motion blur follows movement: none when still, a smear when moving", () => {
    const a: Animation = { ...emptyAnimation(), layers: { dj: { stack: [{ ...newItem("text.slide"), strength: 1, direction: "right" }], blur: 1 } } };
    const kinds = (t: number) => evaluateFrame(scene(), a, t).get("dj")!.raster.map((r) => r.kind);
    let moving = 0;
    for (let i = 0; i < frameCount(a); i += 6) if (kinds(frameTime(a, i)).includes("mblur")) moving++;
    expect(moving).toBeGreaterThan(0);
    const still: Animation = { ...emptyAnimation(), layers: { dj: { stack: [], blur: 1 } } };
    expect(evaluateFrame(scene(), still, 1).get("dj")!.raster).toEqual([]);
  });
  it("timing settings survive a save and reopen", () => {
    const a: Animation = {
      ...emptyAnimation(),
      markers: [{ id: "m1", t: 1.5 }],
      bpm: { bpm: 124, offset: 0.25, show: true },
      layers: { dj: { stack: [{ ...newItem("overlays.burn"), trigger: { on: "beats", every: 2, offset: -0.1, length: 0.8 } }], speed: [{ t: 1, speed: 0.5 }], blur: 0.4 } }
    };
    expect(parseAnimation(JSON.parse(JSON.stringify(a)))).toEqual({ ok: true, value: a });
  });
});
