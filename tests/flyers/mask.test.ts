import { describe, it, expect } from "vitest";
import { addPoint, countNumbers, frameToUV, maskOn, maskRasterSize, MAX_MASK_NUMBERS, sanitizeMask, uvToFrame, type ImageMask } from "@/lib/flyers/mask";
import { checkDjChanges, duplicateNodes, imageLayout, MAX_SCENE_BYTES, parseScene, parseTemplateContent } from "@/lib/flyers/scene";
import type { ImageNode } from "@/lib/flyers/types";

const node = (extra: Record<string, unknown> = {}) => ({ id: "photo1", kind: "image", name: "Portrait", role: "portrait", x: 100, y: 200, width: 600, height: 800, source: { type: "static", src: "/x.png" }, ...extra });
const scene = (n: Record<string, unknown>) => ({ format: "portrait", nodes: [n] });
const mask: ImageMask = {
  v: 1,
  strokes: [
    { mode: "hide", size: 0.1, hardness: 0.5, opacity: 1, points: [0.1, 0.1, 0.2, 0.15, 0.3, 0.2] },
    { mode: "restore", size: 0.05, hardness: 1, opacity: 0.5, points: [0.15, 0.12] }
  ],
  fade: { type: "linear", a: [0.5, 0.7], b: [0.5, 1], reverse: false },
  feather: 0.01
};

describe("layer masks", () => {
  it("older flyers without a mask open unchanged", () => {
    const r = parseScene(scene(node()));
    if (!r.ok) throw new Error(r.error);
    expect((r.value.nodes[0] as ImageNode).mask).toBeUndefined();
  });

  it("save and reopen keeps the mask exactly", () => {
    const r = parseScene(JSON.parse(JSON.stringify(scene(node({ mask })))));
    if (!r.ok) throw new Error(r.error);
    expect((r.value.nodes[0] as ImageNode).mask).toEqual(mask);
  });

  it("cleans bad data: clamps values, drops junk, empty = no mask", () => {
    const m = sanitizeMask({ strokes: [{ mode: "x", size: 99, hardness: -1, opacity: 7, points: [0.123456789, 9, "a", 1, 0.5] }, { points: [] }, null], fade: { type: "radial", a: [0.5, 0.5], b: [0.5, 0.5] }, feather: 3 });
    expect(m).toEqual({ v: 1, strokes: [{ mode: "hide", size: 2, hardness: 0, opacity: 1, points: [0.1235, 1.5] }], fade: null, feather: 0.1 });
    expect(sanitizeMask({ strokes: [], fade: null, feather: 0.05 })).toBeNull();
    expect(sanitizeMask("nope")).toBeNull();
    expect(maskOn(null)).toBe(false);
  });

  it("caps how much brush work one mask stores", () => {
    const long = Array.from({ length: 30_000 }, (_, i) => (i % 100) / 100);
    const m = sanitizeMask({ strokes: [{ mode: "hide", size: 0.1, hardness: 1, opacity: 1, points: long }, { mode: "hide", size: 0.1, hardness: 1, opacity: 1, points: [0.5, 0.5] }] });
    expect(countNumbers(m)).toBeLessThanOrEqual(MAX_MASK_NUMBERS);
    // A full mask still saves well under the flyer size limit.
    expect(JSON.stringify(scene(node({ mask: m }))).length).toBeLessThan(MAX_SCENE_BYTES / 2);
  });

  it("brush points are only stored once the brush has moved", () => {
    let pts = [0.5, 0.5];
    pts = addPoint(pts, 0.5001, 0.5, 0.1);
    expect(pts).toHaveLength(2);
    pts = addPoint(pts, 0.52, 0.5, 0.1);
    expect(pts).toEqual([0.5, 0.5, 0.52, 0.5]);
  });

  it("is stored on the picture's own pixels: crop, zoom and flip don't move it", () => {
    const natural = { width: 4000, height: 6000 };
    const frame = { width: 600, height: 800 };
    for (const crop of [{ zoom: 1, x: 0, y: 0 }, { zoom: 2.5, x: 0.4, y: -0.7 }]) {
      const lay = imageLayout(frame, natural, "cover", crop);
      for (const [fx, fy] of [[false, false], [true, false], [false, true], [true, true]] as const) {
        const p = uvToFrame(0.3, 0.8, lay, fx, fy);
        const [u, v] = frameToUV(p, lay, fx, fy);
        expect(u).toBeCloseTo(0.3, 6);
        expect(v).toBeCloseTo(0.8, 6);
      }
    }
    // Flipped, the same image point sits on the other side of the frame.
    const lay = imageLayout(frame, natural, "cover", { zoom: 1, x: 0, y: 0 });
    expect(uvToFrame(0.2, 0.5, lay, true, false).x).toBeCloseTo(lay.x + 0.8 * lay.width, 6);
  });

  it("draws at the shown size, never above the file's pixels or 2048", () => {
    const lay = { x: 0, y: 0, width: 600, height: 900 };
    expect(maskRasterSize({ width: 4000, height: 6000 }, lay, 1)).toEqual({ width: 600, height: 900 });
    expect(maskRasterSize({ width: 4000, height: 6000 }, lay, 3)).toEqual({ width: 1800, height: 2700 });
    expect(maskRasterSize({ width: 3840, height: 2160 }, { ...lay, width: 5000 }, 2).width).toBe(2048);
    expect(maskRasterSize({ width: 300, height: 450 }, lay, 2)).toEqual({ width: 300, height: 450 });
  });

  it("templates keep their masks", () => {
    const r = parseTemplateContent(JSON.parse(JSON.stringify({ formats: { portrait: scene(node({ mask })) } })));
    if (!r.ok) throw new Error(r.error);
    expect((r.value.formats.portrait!.nodes[0] as ImageNode).mask).toEqual(mask);
  });

  it("is copied with the layer when duplicated", () => {
    const r = parseScene(scene(node({ mask })));
    if (!r.ok) throw new Error(r.error);
    const { nodes } = duplicateNodes(r.value.nodes, ["photo1"]);
    const copy = nodes.find((n) => n.id !== "photo1") as ImageNode;
    expect(copy.mask).toEqual(mask);
    expect(copy.mask).not.toBe((r.value.nodes[0] as ImageNode).mask);
  });

  it("a template's locked style covers the mask", () => {
    const locked = { move: true, edit: true, style: false, remove: true };
    const prev = parseScene(scene(node({ perms: locked })));
    const next = parseScene(scene(node({ perms: locked, mask })));
    if (!prev.ok || !next.ok) throw new Error("parse");
    expect(checkDjChanges(prev.value, next.value)).toMatch(/style/);
    expect(checkDjChanges(next.value, next.value)).toBeNull();
  });
});
