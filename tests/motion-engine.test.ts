import { describe, expect, it } from "vitest";
import { newText, newImage } from "@/lib/flyers/scene";
import type { Scene } from "@/lib/flyers/types";
import { MOTION_PRESETS, PRESET_BY_ID, presetFits } from "@/lib/flyers/motion/presets";
import { checkLoop, evaluateFrame, frameCount } from "@/lib/flyers/motion/engine";
import { emptyAnimation, type Animation } from "@/lib/flyers/motion/types";
import { newItem, applyRecipe, RECIPES, planRecipe } from "@/lib/flyers/motion/recipes";
import { parseAnimation } from "@/lib/flyers/motion/schema";
import { graphemes, revealCount } from "@/lib/flyers/motion/graphemes";

const S = { width: 1080, height: 1920 };
function scene(): Scene {
  return {
    version: 1, format: "story", width: 1080, height: 1920, background: "#000", safeMargin: 40,
    nodes: [
      newImage("background", { type: "static", src: "/bg.jpg" }, S, { id: "bg" } as never),
      newText("title", S, { id: "title", text: "BLACKOUT", x: 90, y: 900, width: 900, height: 170 } as never),
      newText("date", S, { id: "date", text: "{{event.dayNumber|25}}", x: 130, y: 430, width: 235, height: 210 } as never),
      newText("details", S, { id: "tag", text: "THE NIGHT BEFORE THANKSGIVING", x: 130, y: 1620, width: 820, height: 35 } as never),
      newImage("portrait", { type: "dj_photo", slot: 1 }, S, { id: "photo", x: 200, y: 600, width: 680, height: 900 } as never)
    ]
  };
}
const withStack = (a: Animation, id: string, preset: string, patch = {}) => ({ ...a, layers: { ...a.layers, [id]: { stack: [newItem(preset, patch)] } } });

describe("every implemented preset loops cleanly", () => {
  for (const p of MOTION_PRESETS) {
    it(p.id, () => {
      const sc = scene();
      const target = sc.nodes.find((n) => presetFits(p, n, n.role, false) === true)!;
      expect(target, `a layer for ${p.id}`).toBeTruthy();
      const anim = { ...withStack(emptyAnimation(), target.id, p.id, { strength: 0.6, cycles: 2 }), readableLock: false };
      // t = duration is frame 0 again: same state.
      expect(evaluateFrame(sc, anim, anim.duration).get(target.id)).toEqual(evaluateFrame(sc, anim, 0).get(target.id));
      // Deterministic: the same frame twice is identical.
      expect(evaluateFrame(sc, anim, 3.3).get(target.id)).toEqual(evaluateFrame(sc, anim, 3.3).get(target.id));
      // No jump across the seam (last frame → first).
      expect(checkLoop(sc, anim)).toMatchObject({ ok: true, frames: 240 });
    });
  }
});

describe("engine", () => {
  it("8 s at 30 fps is 240 frames, and nothing animates without motion", () => {
    expect(frameCount(emptyAnimation())).toBe(240);
    expect(evaluateFrame(scene(), emptyAnimation(), 1).size).toBe(0);
    expect(evaluateFrame(scene(), { ...withStack(emptyAnimation(), "title", "text.pulse"), enabled: false }, 1).size).toBe(0);
  });
  it("slide stays inside the safe area and protected details move at most 16 px", () => {
    const sc = scene();
    const a = { ...withStack(emptyAnimation(), "title", "text.slide", { direction: "left", strength: 1 }), intensity: "high" as const, readableLock: false };
    const worst = Math.min(...Array.from({ length: 240 }, (_, i) => evaluateFrame(sc, a, i / 30).get("title")!.dx));
    expect(worst).toBeGreaterThanOrEqual(-(90 - 40) - 1e-6);
    const b = { ...withStack(emptyAnimation(), "date", "text.slide", { direction: "up", strength: 1 }), intensity: "high" as const };
    const most = Math.max(...Array.from({ length: 240 }, (_, i) => Math.abs(evaluateFrame(sc, b, i / 30).get("date")!.dy)));
    expect(most).toBeLessThanOrEqual(16 + 1e-6);
  });
  it("the readable lock blocks reveals on dates but not on decorative text", () => {
    const sc = scene();
    const date = sc.nodes.find((n) => n.id === "date")!;
    const tag = sc.nodes.find((n) => n.id === "tag")!;
    const rev = PRESET_BY_ID.get("text.letter-reveal")!;
    expect(presetFits(rev, date, date.role, true)).not.toBe(true);
    expect(presetFits(rev, tag, tag.role, true)).toBe(true);
    expect(presetFits(rev, date, date.role, false)).toBe(true);
    // A blocked preset does nothing even if it is in the stack.
    const a = withStack(emptyAnimation(), "date", "text.letter-reveal");
    expect(evaluateFrame(sc, a, 0).get("date")!.reveal).toBeNull();
  });
  it("protected text fades at most 15%", () => {
    const sc = scene();
    const a = { ...withStack(emptyAnimation(), "date", "text.fade", { strength: 1 }), intensity: "high" as const };
    const min = Math.min(...Array.from({ length: 240 }, (_, i) => evaluateFrame(sc, a, i / 30).get("date")!.opacity));
    expect(min).toBeGreaterThanOrEqual(0.85 - 1e-9);
  });
  it("reveals start hidden, hold fully shown, and reverse (no jump at the wrap)", () => {
    const sc = scene();
    const a = withStack(emptyAnimation(), "tag", "text.letter-reveal");
    const at = (t: number) => evaluateFrame(sc, a, t).get("tag")!.reveal!.amount;
    expect(at(0)).toBe(0);
    expect(at(4)).toBe(1);
    expect(at(7.9)).toBeLessThan(0.2);
  });
  it("background pan never shows an edge", () => {
    const sc = scene();
    const a = withStack(emptyAnimation(), "bg", "backgrounds.pan", { strength: 1 });
    for (let i = 0; i < 240; i += 7) {
      const s = evaluateFrame(sc, { ...a, intensity: "high" }, i / 30).get("bg")!.inner!;
      expect(Math.abs(s.dx)).toBeLessThanOrEqual(((s.scale - 1) * 1080) / 2 + 1e-6);
    }
  });
  it("particles are bounded and seeded", () => {
    const sc = scene();
    const a = { ...withStack(emptyAnimation(), "bg", "overlays.dust", { strength: 1 }), intensity: "high" as const };
    const o = evaluateFrame(sc, a, 2).get("bg")!.overlays[0];
    expect(o.kind === "particles" && o.items.length).toBeLessThanOrEqual(80);
    const b = withStack(emptyAnimation(), "bg", "overlays.dust", { seed: 7 });
    expect(evaluateFrame(sc, b, 2)).not.toEqual(evaluateFrame(sc, withStack(emptyAnimation(), "bg", "overlays.dust", { seed: 8 }), 2));
    expect(evaluateFrame(sc, a, 2, { reduced: true }).get("bg")!.overlays).toHaveLength(0);
  });
  it("mute and solo", () => {
    const sc = scene();
    let a = withStack(withStack(emptyAnimation(), "title", "text.pulse"), "bg", "backgrounds.zoom");
    a = { ...a, layers: { ...a.layers, bg: { ...a.layers.bg, solo: true } } };
    expect([...evaluateFrame(sc, a, 1).keys()]).toEqual(["bg"]);
    a = { ...a, layers: { ...a.layers, bg: { ...a.layers.bg, solo: false, muted: true } } };
    expect([...evaluateFrame(sc, a, 1).keys()]).toEqual(["title"]);
  });
});

describe("recipes", () => {
  it("only touch matching roles and keep protected details steady", () => {
    const sc = scene();
    for (const r of RECIPES) {
      const plan = planRecipe(r, sc.nodes, emptyAnimation());
      expect(plan.date).toBeUndefined();
      for (const [id, items] of Object.entries(plan)) {
        const n = sc.nodes.find((x) => x.id === id)!;
        for (const it of items) expect(presetFits(PRESET_BY_ID.get(it.preset)!, n, n.role, true)).toBe(true);
      }
    }
  });
  it("leaves layers it doesn't plan for alone", () => {
    const sc = scene();
    const a = withStack(emptyAnimation(), "date", "text.tracking");
    const b = applyRecipe(RECIPES[0], sc.nodes, a);
    expect(b.layers.date).toEqual(a.layers.date);
    expect(b.recipe).toBe("clean-promo");
  });
});

describe("saved settings", () => {
  it("round-trip and reject bad input", () => {
    const a = applyRecipe(RECIPES[1], scene().nodes, emptyAnimation());
    const p = parseAnimation(JSON.parse(JSON.stringify(a)));
    expect(p.ok && p.value).toEqual(a);
    expect(parseAnimation({ ...a, layers: { x: { stack: [{ id: "a", preset: "nope" }] } } }).ok).toBe(false);
    expect(parseAnimation(null)).toEqual({ ok: true, value: null });
    const odd = parseAnimation({ ...a, duration: 7, layers: { t: { stack: [{ ...newItem("text.pulse"), cycles: 2.6 }] } } });
    expect(odd.ok && [odd.value!.duration, odd.value!.layers.t.stack[0].cycles]).toEqual([8, 3]);
  });
});

describe("graphemes", () => {
  it("keep emoji, accents and flags whole", () => {
    expect(graphemes("Café 🇺🇸👩🏽‍🎤")).toEqual(["C", "a", "f", "é", " ", "🇺🇸", "👩🏽‍🎤"]);
    expect(revealCount("Café 🇺🇸👩🏽‍🎤", "letter", 0.5)).toBe(3);
    expect(revealCount("THE NIGHT BEFORE", "word", 0.67)).toBe(9);
    expect(revealCount("THE NIGHT\nBEFORE", "word", 1)).toBe(16);
  });
});
