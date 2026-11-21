import { describe, it, expect } from "vitest";
import { applyEffects, effectsOn, newEffects, PRESETS, sanitizeEffects, type Pixels, type PhotoEffects } from "@/lib/flyers/effects";
import { checkDjChanges, parseScene } from "@/lib/flyers/scene";

/** A synthetic cut-out portrait: transparent background, an oval "subject" with a lit face, skin patches and dark clothes. */
function portrait(w = 120, h = 150, skin: [number, number, number] = [205, 160, 130]): Pixels {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const dx = (x - w / 2) / (w * 0.36);
      const dy = (y - h * 0.55) / (h * 0.42);
      const r = Math.hypot(dx, dy);
      if (r > 1) continue; // transparent background
      const edge = Math.min(1, (1 - r) * 12); // soft anti-aliased edge
      const face = y < h * 0.45;
      const shade = 0.55 + 0.45 * (1 - x / w); // lit from the left
      const c = face ? skin : [40, 44, 60];
      d[i] = c[0] * shade;
      d[i + 1] = c[1] * shade;
      d[i + 2] = c[2] * shade;
      d[i + 3] = Math.round(edge * 255);
    }
  return { data: d, width: w, height: h };
}
const opaque = (w = 80, h = 80): Pixels => {
  const d = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    d[i * 4] = (i % w) * 3;
    d[i * 4 + 1] = Math.floor(i / w) * 3;
    d[i * 4 + 2] = 120;
    d[i * 4 + 3] = 255;
  }
  return { data: d, width: w, height: h };
};
const fxOf = (id: PhotoEffects["preset"], patch: Partial<PhotoEffects> = {}): PhotoEffects => ({ ...newEffects(id, 12345), ...patch });
const L = (r: number, g: number, b: number) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
/** Average color of the opaque pixels, and a coarse 4×4 luminance thumbnail (to tell looks apart). */
function signature(p: Pixels) {
  let r = 0, g = 0, b = 0, n = 0;
  const grid = new Array(16).fill(0), cnt = new Array(16).fill(0);
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) {
      const i = (y * p.width + x) * 4;
      if (p.data[i + 3] < 250) continue;
      r += p.data[i]; g += p.data[i + 1]; b += p.data[i + 2]; n++;
      const c = Math.floor((y / p.height) * 4) * 4 + Math.floor((x / p.width) * 4);
      grid[c] += L(p.data[i], p.data[i + 1], p.data[i + 2]); cnt[c]++;
    }
  // local contrast: how much neighbouring pixels differ (halftone dots, scanlines, grain)
  let busy = 0;
  for (let i = 4; i < p.data.length; i += 4) if (p.data[i + 3] > 250 && p.data[i - 1] > 250) busy += Math.abs(L(p.data[i], p.data[i + 1], p.data[i + 2]) - L(p.data[i - 4], p.data[i - 3], p.data[i - 2]));
  return [r / n / 255, g / n / 255, b / n / 255, ...grid.map((v, i) => (cnt[i] ? v / cnt[i] : 0)), (busy / n) * 4];
}
const dist = (a: number[], b: number[]) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0));

describe("photo effects engine", () => {
  const src = portrait();

  it("each preset looks clearly different from the photo and from every other preset", () => {
    const sigs = PRESETS.map((p) => ({ id: p.id, s: signature(applyEffects(src, fxOf(p.id))) }));
    const orig = signature(src);
    for (const a of sigs) expect(dist(a.s, orig), `${a.id} vs original`).toBeGreaterThan(0.08);
    for (let i = 0; i < sigs.length; i++)
      for (let j = i + 1; j < sigs.length; j++) expect(dist(sigs[i].s, sigs[j].s), `${sigs[i].id} vs ${sigs[j].id}`).toBeGreaterThan(0.05);
  });

  it("strength 0 (and no effects) returns the photo unchanged", () => {
    for (const p of PRESETS) expect(Buffer.from(applyEffects(src, fxOf(p.id, { strength: 0 })).data).equals(Buffer.from(src.data))).toBe(true);
    expect(effectsOn(null)).toBe(false);
    expect(effectsOn(undefined)).toBe(false);
  });

  it("half strength sits between the photo and the full effect", () => {
    const full = signature(applyEffects(src, fxOf("neon_duotone")));
    const half = signature(applyEffects(src, fxOf("neon_duotone", { strength: 0.5 })));
    const orig = signature(src);
    expect(dist(half, orig)).toBeLessThan(dist(full, orig));
    expect(dist(half, full)).toBeLessThan(dist(full, orig));
  });

  it("keeps the cutout: the background stays transparent and edges keep their alpha", () => {
    const corners = [0, src.width - 1, (src.height - 1) * src.width, src.height * src.width - 1];
    for (const p of PRESETS) {
      const out = applyEffects(src, fxOf(p.id));
      for (const c of corners) expect(out.data[c * 4 + 3], `${p.id} corner`).toBe(0);
      // presets that add nothing behind the subject or move rows keep every alpha value exactly
      if (!["red_strobe", "direct_flash", "vhs"].includes(p.id))
        for (let i = 3; i < src.data.length; i += 4) if (out.data[i] !== src.data[i]) throw new Error(`${p.id} changed alpha at ${i}`);
      // and nothing becomes an opaque rectangle
      let solid = 0, before = 0;
      for (let i = 3; i < out.data.length; i += 4) {
        if (out.data[i] >= 250) solid++;
        if (src.data[i] >= 250) before++;
      }
      expect(solid, p.id).toBeLessThanOrEqual(before * 1.02);
    }
  });

  it("echoes and the subject shadow sit behind the subject, softly, inside the frame", () => {
    const echo = applyEffects(src, fxOf("red_strobe"));
    const shadow = applyEffects(src, fxOf("direct_flash"));
    const added = (o: Pixels) => {
      let n = 0;
      for (let i = 3; i < o.data.length; i += 4) if (src.data[i] === 0 && o.data[i] > 0) n++;
      return n;
    };
    expect(added(echo)).toBeGreaterThan(100);
    expect(added(shadow)).toBeGreaterThan(50);
    // no echo or shadow pixel is fully opaque outside the subject
    for (const o of [echo, shadow]) for (let i = 3; i < o.data.length; i += 4) if (src.data[i] === 0) expect(o.data[i]).toBeLessThan(200);
  });

  it("mask effects are skipped on a rectangular photo (no glowing box)", () => {
    const rect = opaque();
    const out = applyEffects(rect, fxOf("emerald", { params: { edgeOn: true, edgeOpacity: 100 } }));
    for (let i = 3; i < out.data.length; i += 4) expect(out.data[i]).toBe(255);
  });

  it("works across skin tones: shading order kept, faces not crushed or blown out", () => {
    const tones: [number, number, number][] = [
      [241, 206, 180],
      [205, 160, 130],
      [150, 104, 74],
      [92, 58, 40]
    ];
    for (const id of ["emerald", "golden_hour", "direct_flash", "midnight_blue", "vintage_print"] as const) {
      const lums = tones.map((t) => {
        const p = portrait(60, 80, t);
        const o = applyEffects(p, fxOf(id));
        const i = (24 * 60 + 30) * 4; // the middle of the face
        // warm grades keep skin warm (red over blue), including deep skin
        if (id !== "midnight_blue") expect(o.data[i], `${id} keeps ${t} skin warm`).toBeGreaterThanOrEqual(o.data[i + 2]);
        return { before: L(p.data[i], p.data[i + 1], p.data[i + 2]), after: L(o.data[i], o.data[i + 1], o.data[i + 2]) };
      });
      for (let k = 1; k < lums.length; k++) expect(lums[k].after, `${id} keeps lighter skin lighter`).toBeLessThan(lums[k - 1].after);
      for (const v of lums) {
        expect(Math.abs(v.after - v.before), id).toBeLessThan(0.3);
        expect(v.after, id).toBeGreaterThan(0.04);
        expect(v.after, id).toBeLessThan(0.97);
      }
    }
  });

  it("graphic looks keep light and deep skin out of solid black or white", () => {
    for (const id of ["silver_noir", "halftone", "neon_duotone"] as const)
      for (const t of [[241, 206, 180], [92, 58, 40]] as [number, number, number][]) {
        const p = portrait(120, 150, t);
        const o = applyEffects(p, fxOf(id));
        // average lightness over the middle of the face (halftone dots average out)
        let sum = 0, k = 0;
        for (let y = 36; y < 56; y++) for (let x = 50; x < 70; x++) { const i = (y * 120 + x) * 4; sum += L(o.data[i], o.data[i + 1], o.data[i + 2]); k++; }
        const avg = sum / k;
        expect(avg, `${id} ${t}`).toBeGreaterThan(0.12);
        expect(avg, `${id} ${t}`).toBeLessThan(0.92);
      }
  });

  it("textures are stable for a seed (preview = save = export) and change with a new seed", () => {
    const a = applyEffects(src, fxOf("vintage_print"));
    const b = applyEffects(src, fxOf("vintage_print"));
    const c = applyEffects(src, { ...fxOf("vintage_print"), seed: 999 });
    expect(Buffer.from(a.data).equals(Buffer.from(b.data))).toBe(true);
    expect(Buffer.from(a.data).equals(Buffer.from(c.data))).toBe(false);
  });

  it("a 2× export looks like the 1× preview (sizes and textures scale together)", () => {
    const big = portrait(240, 300);
    const small = portrait(120, 150);
    for (const id of ["halftone", "vhs", "xerox", "emerald", "silver_noir"] as const) {
      const o2 = applyEffects(big, fxOf(id), 2);
      const o1 = applyEffects(small, fxOf(id), 1);
      const s2 = signature(o2), s1 = signature(o1);
      expect(dist(s1.slice(0, 19), s2.slice(0, 19)), id).toBeLessThan(0.12);
    }
  });
});

describe("saved settings", () => {
  const node = (extra: Record<string, unknown> = {}) => ({ id: "photo1", kind: "image", name: "DJ photo", role: "portrait", x: 100, y: 200, width: 600, height: 800, source: { type: "dj_photo", slot: 1 }, ...extra });
  const scene = (n: Record<string, unknown>) => ({ format: "portrait", nodes: [n] });

  it("older flyers without effects open normally", () => {
    const r = parseScene(scene(node()));
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.value.nodes[0] as { effects?: unknown }).effects).toBeUndefined();
  });

  it("effects are saved versioned and cleaned", () => {
    const r = parseScene(scene(node({ effects: { preset: "halftone", strength: 3, seed: 42, params: { dotSize: 999, inkColor: "#FF0000", bogus: 1, contrast: "x" }, mask: { fade: 40, fadeAt: 60 } } })));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect((r.value.nodes[0] as { effects: PhotoEffects }).effects).toEqual({ v: 1, preset: "halftone", strength: 1, seed: 42, params: { dotSize: 40, inkColor: "#ff0000" }, mask: { fade: 40, fadeAt: 60 }, custom: null });
    expect(sanitizeEffects({ preset: "nope" })).toBeNull();
  });

  it("save and reopen gives the same picture", () => {
    const fx = fxOf("vhs", { params: { scanlines: 70 }, mask: { fade: 30, fadeAt: 50 } });
    const r = parseScene(JSON.parse(JSON.stringify(scene(node({ effects: fx })))));
    if (!r.ok) throw new Error(r.error);
    const again = (r.value.nodes[0] as { effects: PhotoEffects }).effects;
    const src = portrait();
    expect(Buffer.from(applyEffects(src, again).data).equals(Buffer.from(applyEffects(src, fx).data))).toBe(true);
  });

  it("a template's locked style covers effects too", () => {
    const locked = { move: true, edit: true, style: false, remove: true };
    const prev = parseScene(scene(node({ perms: locked })));
    const next = parseScene(scene(node({ perms: locked, effects: fxOf("emerald") })));
    if (!prev.ok || !next.ok) throw new Error("parse");
    expect(checkDjChanges(prev.value, next.value)).toMatch(/style/);
    expect(checkDjChanges(prev.value, prev.value)).toBeNull();
  });
});
