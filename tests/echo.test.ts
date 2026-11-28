import { describe, expect, it } from "vitest";
import { newImage, newText } from "@/lib/flyers/scene";
import type { Scene } from "@/lib/flyers/types";
import { ECHO_PRESETS, mixHex, echoBounds, echoCopies, newEcho, resolveEcho, sanitizeEcho, silhouetteOffsets } from "@/lib/flyers/echo";
import { checkLoop, evaluateFrame } from "@/lib/flyers/motion/engine";
import { ECHO_MOTION, MOTION_PRESETS, PRESET_BY_ID, PLANNED, optsFor, presetFits } from "@/lib/flyers/motion/presets";
import { newItem } from "@/lib/flyers/motion/recipes";
import { emptyAnimation, type Animation } from "@/lib/flyers/motion/types";
import * as sceneLib from "@/lib/flyers/scene";

const S = { width: 1080, height: 1350 };
function scene(): Scene {
  return {
    version: 1, format: "portrait", width: 1080, height: 1350, background: "#000", safeMargin: 40,
    nodes: [
      newImage("background", { type: "static", src: "/bg.jpg" }, S, { id: "bg" } as never),
      newText("title", S, { id: "title", text: "DJ NIGHT", x: 90, y: 200, width: 900, height: 200 } as never),
      newImage("portrait", { type: "static", src: "/flyers/sample/portraits/dj-01.png" }, S, { id: "dj", x: 290, y: 400, width: 500, height: 500 } as never)
    ]
  };
}

describe("Echo presets", () => {
  it("has the eight presets from the reference sheet, each a distinct still", () => {
    expect(ECHO_PRESETS.map((p) => p.name)).toEqual(["Silhouette Trail", "RGB Echo", "Outline Echo", "Mirror Echo", "Zoom Echo", "Orbit Echo", "Slice Echo", "Long Exposure"]);
    const sigs = ECHO_PRESETS.map((p) => {
      const { copies, extra } = echoCopies(newEcho(p.id), 500, 500);
      expect(copies.length).toBeGreaterThan(0);
      return JSON.stringify([copies.map((c) => [c.mode, Math.round(c.dx), Math.round(c.dy), c.scale.toFixed(2), Math.round(c.rotate), c.flipX, c.color, !!c.band, c.mono, Math.round(c.blur)]), !!extra.ring]);
    });
    expect(new Set(sigs).size).toBe(8);
  });
  it("silhouette and outline use the subject's outline; the others the picture", () => {
    const modes = Object.fromEntries(ECHO_PRESETS.map((p) => [p.id, new Set(echoCopies(newEcho(p.id), 500, 500).copies.map((c) => c.mode))]));
    expect([...modes.silhouette_trail]).toEqual(["silhouette"]);
    expect([...modes.outline_echo]).toEqual(["outline"]);
    for (const id of ["rgb_echo", "mirror_echo", "zoom_echo", "orbit_echo", "slice_echo", "long_exposure"]) expect([...modes[id]]).toEqual(["image"]);
    expect(ECHO_PRESETS.filter((p) => p.needsCutout).map((p) => p.id)).toEqual(["silhouette_trail", "outline_echo"]);
  });
  it("keeps the sharp original on top by default, and every setting editable", () => {
    for (const p of ECHO_PRESETS) {
      expect(echoCopies(newEcho(p.id), 500, 500).original).toBe(true);
      expect(p.controls).toContain("original");
    }
    expect(echoCopies({ preset: "rgb_echo", params: { original: false } }, 500, 500).original).toBe(false);
    // A changed setting changes the copies.
    const a = echoCopies(newEcho("silhouette_trail"), 500, 500).copies;
    const b = echoCopies({ preset: "silhouette_trail", params: { spacing: 30, count: 6 } }, 500, 500).copies;
    expect(b.length).toBe(6);
    expect(Math.abs(b[0].dx)).toBeGreaterThan(Math.abs(a[0].dx));
  });
  it("the echoes reach past the frame and the drawing is sized to them", () => {
    const { copies, extra } = echoCopies(newEcho("silhouette_trail"), 500, 500);
    const b = echoBounds(copies, extra, 500, 500);
    expect(b.x).toBeLessThan(-200); // the trail goes left
    expect(b.x + b.w).toBeGreaterThanOrEqual(500);
  });
  it("saved settings are cleaned (bad values dropped, ranges kept)", () => {
    expect(sanitizeEcho({ preset: "nope" })).toBeNull();
    const e = sanitizeEcho({ preset: "outline_echo", seed: 3, params: { count: 99, color: "#ABCDEF", width: "x", bogus: 1, ring: true } })!;
    expect(e.params).toEqual({ count: 16, color: "#abcdef", ring: true });
    expect(resolveEcho(e).width).toBe(3);
  });
  it("Red Strobe's in-frame silhouette echo keeps its old offsets", () => {
    // Previously: alternating right/left, ceil(e/2) × offset, fading by (e − 1)/(count + 1).
    expect(silhouetteOffsets(3, 28)).toEqual([
      { dx: 28, fade: 1 },
      { dx: -28, fade: 0.75 },
      { dx: 56, fade: 0.5 }
    ]);
  });
  it("saves with the scene, and older flyers without an echo still load", () => {
    const parse = (v: unknown) => {
      const r = sceneLib.parseScene(v) as { ok?: boolean; value?: Scene; scene?: Scene; data?: Scene };
      return (r.value ?? r.scene ?? r.data ?? (r as unknown as Scene)) as Scene;
    };
    const sc = scene();
    const old = parse(JSON.parse(JSON.stringify(sc)))!;
    expect(old.nodes.find((n) => n.id === "dj")!.echo).toBeUndefined();
    const withEcho = { ...sc, nodes: sc.nodes.map((n) => (n.id === "dj" ? { ...n, echo: { v: 1, preset: "orbit_echo", params: { count: 6 }, seed: 9 } } : n)) };
    const back = parse(JSON.parse(JSON.stringify(withEcho)))!;
    expect(back.nodes.find((n) => n.id === "dj")!.echo).toEqual({ v: 1, preset: "orbit_echo", params: { count: 6 }, seed: 9 });
  });
});

describe("Echo colour", () => {
  it("every preset can colour its copies, blend them and glow", () => {
    for (const p of ECHO_PRESETS) {
      for (const k of ["color", "glow", "blend"]) expect(p.controls, `${p.id} ${k}`).toContain(k);
      if (p.id !== "outline_echo") expect(p.controls, p.id).toContain("fill");
      expect(p.controls[p.controls.length - 1]).toBe("original");
    }
  });
  it("solid colour turns photo copies into coloured shapes; tint keeps the photo", () => {
    const solid = echoCopies({ preset: "mirror_echo", params: { fill: "solid", color: "#ff0000" } }, 500, 500).copies;
    expect(solid.every((c) => c.mode === "silhouette" && c.color === "#ff0000")).toBe(true);
    const tint = echoCopies({ preset: "slice_echo", params: { fill: "tint", color: "#00ff00", tint: 50 } }, 500, 500).copies;
    expect(tint.every((c) => c.mode === "image" && c.color === "#00ff00" && c.tint === 0.5)).toBe(true);
  });
  it("the gradient runs from Colour (nearest) to Second colour (furthest)", () => {
    const c = echoCopies({ preset: "silhouette_trail", params: { gradient: true, count: 3, color: "#000000", color2: "#ffffff" } }, 500, 500).copies;
    // drawn furthest first
    expect(c.map((x) => x.color)).toEqual(["#ffffff", "#808080", "#000000"]);
    expect(mixHex("#ff0000", "#0000ff", 0.5)).toBe("#800080");
  });
  it("defaults look as before (older echoes are unchanged)", () => {
    const m = (id: string) => echoCopies(newEcho(id as never), 500, 500).copies;
    expect(new Set(m("silhouette_trail").map((c) => c.mode))).toEqual(new Set(["silhouette"]));
    expect(m("silhouette_trail").every((c) => c.color === "#19c2a8")).toBe(true);
    expect(m("rgb_echo").map((c) => c.color).reverse()).toEqual(["#2f5bff", "#1fd655", "#ff2d3d"]);
    expect(m("mirror_echo").every((c) => c.mode === "image" && c.color === null && c.tint === 0 && c.glow === 0)).toBe(true);
    expect(echoCopies(newEcho("rgb_echo"), 500, 500).extra.blend).toBe("normal");
  });
  it("blend and fill are kept only when valid", () => {
    expect(sanitizeEcho({ preset: "zoom_echo", params: { blend: "add", fill: "solid" } })!.params).toEqual({ blend: "add", fill: "solid" });
    expect(sanitizeEcho({ preset: "zoom_echo", params: { blend: "xor", fill: "#ffffff" } })!.params).toEqual({});
  });
});

describe("Echo in Animate", () => {
  it("the Echo category has all eight, on picture layers, with the still echo's settings", () => {
    expect(ECHO_MOTION.map((p) => p.name)).toEqual(ECHO_PRESETS.map((p) => p.name));
    expect(MOTION_PRESETS.filter((p) => p.category === "echo").length).toBe(8);
    const dj = scene().nodes[2];
    const title = scene().nodes[1];
    for (const p of ECHO_MOTION) {
      expect(presetFits(p, dj, "portrait", true)).toBe(true);
      expect(presetFits(p, title, "title", true)).not.toBe(true);
      // Same defaults as the still preset.
      const d = resolveEcho({ preset: p.id.slice(5).replace(/-/g, "_") });
      for (const c of p.controls ?? []) expect(optsFor(p, newItem(p.id))[c.key]).toEqual(d[c.key as keyof typeof d]);
    }
    expect(PRESET_BY_ID.get("photos.echo")!.id).toBe("echo.silhouette-trail");
    expect(PLANNED.some((p) => p.id === "photos.echo")).toBe(false);
  });
  it("frame 0 of an animated echo is the still echo", () => {
    for (const p of ECHO_MOTION) {
      const a: Animation = { ...emptyAnimation(), layers: { dj: { stack: [newItem(p.id)] } } };
      const st = evaluateFrame(scene(), a, 0).get("dj")!;
      expect(st.echo).toBeTruthy();
      const still = echoCopies({ preset: st.echo!.preset, params: st.echo!.params, seed: st.echo!.seed }, 500, 500);
      const moving = echoCopies(st.echo!, 500, 500, st.echo!.u, st.echo!.amount);
      const vis = (cs: typeof still.copies) => cs.filter((c) => c.opacity > 0.003).map((c) => [Math.round(c.dx), Math.round(c.dy), c.scale.toFixed(3), c.opacity.toFixed(3)]).sort();
      expect(vis(moving.copies)).toEqual(vis(still.copies));
    }
  });
  it("every echo loops cleanly, and actually moves", () => {
    for (const p of ECHO_MOTION) {
      const a: Animation = { ...emptyAnimation(), layers: { dj: { stack: [newItem(p.id)] } } };
      expect(checkLoop(scene(), a).ok, p.id).toBe(true);
      const f0 = evaluateFrame(scene(), a, 0).get("dj")!.echo!;
      const f1 = evaluateFrame(scene(), a, a.duration * 0.3).get("dj")!.echo!;
      expect(JSON.stringify(echoCopies(f0, 500, 500, f0.u, f0.amount).copies)).not.toEqual(JSON.stringify(echoCopies(f1, 500, 500, f1.u, f1.amount).copies));
    }
  });
});
