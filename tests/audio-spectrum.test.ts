import { describe, expect, it } from "vitest";
import { bandBins, bandLevels, barCountFor, fmtTime, smoothLevels } from "@/lib/audio/spectrum";

describe("player spectrum", () => {
  it("spaces bars logarithmically so bass gets few bins and highs get many", () => {
    const b = bandBins(80, 2048, 44100);
    expect(b).toHaveLength(80);
    for (let i = 1; i < b.length; i++) expect(b[i][0]).toBeGreaterThanOrEqual(b[i - 1][1] - 1);
    const width = (i: number) => b[i][1] - b[i][0];
    expect(width(0)).toBeLessThanOrEqual(2);
    expect(width(79)).toBeGreaterThan(40);
    // Only a small share of bars is below 250 Hz (bass doesn't take over).
    const binHz = 22050 / 2048;
    expect(b.filter(([s]) => s * binHz < 250).length).toBeLessThan(80 * 0.3);
  });
  it("normalizes into 0–1 without clipping, and silence is zero", () => {
    const bands = bandBins(64, 2048, 48000);
    const out = new Float32Array(64);
    bandLevels(new Uint8Array(2048).fill(255), bands, out);
    expect(Math.max(...out)).toBeLessThanOrEqual(0.981);
    expect(Math.min(...out)).toBeGreaterThan(0.8);
    bandLevels(new Uint8Array(2048), bands, out);
    expect(Math.max(...out)).toBe(0);
  });
  it("rises fast and falls slowly, the same at 30 or 60 fps", () => {
    const a = new Float32Array([0]), t = new Float32Array([1]);
    smoothLevels(a, t, 1 / 60);
    expect(a[0]).toBeGreaterThan(0.5);
    const d60 = new Float32Array([1]), d30 = new Float32Array([1]), z = new Float32Array([0]);
    for (let i = 0; i < 60; i++) smoothLevels(d60, z, 1 / 60);
    for (let i = 0; i < 30; i++) smoothLevels(d30, z, 1 / 30);
    expect(Math.abs(d60[0] - d30[0])).toBeLessThan(0.01);
    const one = new Float32Array([1]);
    smoothLevels(one, z, 1 / 60);
    expect(one[0]).toBeGreaterThan(0.8); // decays gently
  });
  it("sizes bars for the width and formats time", () => {
    expect(barCountFor(560)).toBe(80);
    expect(barCountFor(2000)).toBe(96);
    expect(barCountFor(200)).toBe(36);
    expect(fmtTime(227)).toBe("3:47");
    expect(fmtTime(NaN)).toBe("--:--");
    expect(fmtTime(Infinity)).toBe("--:--");
    expect(fmtTime(3725)).toBe("1:02:05");
  });
});
