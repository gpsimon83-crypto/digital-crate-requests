"use client";

/**
 * Turns a layered SVG (Illustrator / Figma / Canva / Inkscape export) into
 * Flyer Creator layers:
 *   - every <text> becomes its own live, editable text layer
 *   - every <image> is uploaded as-is and becomes an image layer
 *   - other vector artwork between them is drawn into transparent PNG layers,
 *     keeping the original stacking order
 * The file is only read: nothing in it runs, and the SVG itself is never stored.
 */
import { canvasFamily, matchFont } from "@/lib/flyers/fonts";
import { FORMATS, type FlyerNode, type Role, type Scene } from "@/lib/flyers/types";
import { LOCKED_PERMS, newImage, newText } from "@/lib/flyers/scene";
import {
  apply,
  guessImageRole,
  guessTextRole,
  humanize,
  isAllCaps,
  multiply,
  parseClassRules,
  parseDecls,
  parseTransform,
  pickFormat,
  px,
  rotationOf,
  scaleX,
  scaleY,
  suggestPlaceholder,
  toHex,
  weightOf,
  type Mat
} from "@/lib/flyers/svg-core";
import { loadSceneFonts } from "./loaders";
import type { Asset } from "./editor-panels";

export type SvgImportOptions = {
  upload: (file: File, kind: string) => Promise<Asset>;
  placeholders: boolean;
  onProgress?: (msg: string) => void;
};
export type SvgImportResult = { scene: Scene; warnings: string[]; texts: number; images: number };

const MAX_SVG_BYTES = 40 * 1024 * 1024;
const SKIP = new Set(["defs", "style", "title", "desc", "metadata", "clippath", "mask", "symbol", "lineargradient", "radialgradient", "pattern", "filter", "marker", "script", "foreignobject", "font", "font-face"]);
const SHAPES = new Set(["path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "use"]);
const INHERITED = ["fill", "stroke", "stroke-width", "font-family", "font-size", "font-weight", "font-style", "letter-spacing", "text-anchor", "visibility", "opacity-inherit"];

type Style = Record<string, string>;

export async function importSvg(file: File, opts: SvgImportOptions): Promise<SvgImportResult> {
  if (file.size > MAX_SVG_BYTES) throw new Error("That SVG is over 40 MB.");
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const root = doc.documentElement;
  if (root.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) throw new Error("That file isn't a readable SVG.");

  // Canvas size: viewBox (or width/height) scaled to 1080 wide.
  const vb = (root.getAttribute("viewBox") ?? "").split(/[\s,]+/).map(Number);
  const vbX = vb.length === 4 && vb.every(Number.isFinite) ? vb[0] : 0;
  const vbY = vb.length === 4 && vb.every(Number.isFinite) ? vb[1] : 0;
  const vbW = vb.length === 4 && vb[2] > 0 ? vb[2] : px(root.getAttribute("width")) ?? 1080;
  const vbH = vb.length === 4 && vb[3] > 0 ? vb[3] : px(root.getAttribute("height")) ?? 1080;
  const { format, off } = pickFormat(vbW, vbH);
  const F = FORMATS[format];
  const warnings: string[] = [];
  if (off > 0.02) warnings.push(`The file is ${Math.round(vbW)} × ${Math.round(vbH)}; it was placed on the ${F.label.toLowerCase()} (${F.size}) canvas. Check the edges.`);
  const k = F.width / vbW;
  const base: Mat = [k, 0, 0, k, -vbX * k, -vbY * k + (F.height - vbH * k) / 2];

  const classes = parseClassRules([...doc.getElementsByTagName("style")].map((s) => s.textContent ?? "").join("\n"));
  const defsMarkup = [...root.children]
    .filter((c) => ["defs", "style"].includes(c.nodeName.toLowerCase()))
    .map((c) => new XMLSerializer().serializeToString(c))
    .join("");

  // All fonts ready before measuring text.
  await loadSceneFonts([], true);
  const measure = document.createElement("canvas").getContext("2d")!;

  const nodes: FlyerNode[] = [];
  const scene = { width: F.width, height: F.height };
  let pending: { el: Element; m: Mat; style: Style }[] = [];
  let texts = 0;
  let images = 0;
  let artCount = 0;
  const usedNames = new Map<string, number>();
  const nameFor = (el: Element, fallback: string) => {
    const raw = el.getAttribute("data-name") || el.getAttribute("inkscape:label") || el.getAttribute("id") || "";
    let n = humanize(raw) || fallback;
    const c = (usedNames.get(n) ?? 0) + 1;
    usedNames.set(n, c);
    if (c > 1) n = `${n} ${c}`;
    return n.slice(0, 60);
  };

  const styleOf = (el: Element, parent: Style): Style => {
    const s: Style = {};
    for (const key of INHERITED) if (parent[key] !== undefined) s[key] = parent[key];
    for (const cls of (el.getAttribute("class") ?? "").split(/\s+/)) Object.assign(s, classes.get(cls) ?? {});
    for (const a of ["fill", "stroke", "stroke-width", "font-family", "font-size", "font-weight", "font-style", "letter-spacing", "text-anchor", "opacity", "visibility", "display"]) {
      const v = el.getAttribute(a);
      if (v !== null) s[a] = v;
    }
    Object.assign(s, parseDecls(el.getAttribute("style") ?? ""));
    return s;
  };

  async function flushArt() {
    if (!pending.length) return;
    const chunk = pending;
    pending = [];
    // Each shape keeps the transform and paint it inherited from its groups.
    const paint = (st: Style) =>
      ["fill", "stroke", "stroke-width"]
        .filter((k) => st[k])
        .map((k) => `${k}:${st[k].replace(/["<>;]/g, "")}`)
        .concat(st["opacity-inherit"] ? [`opacity:${parseFloat(st["opacity-inherit"]) || 1}`] : [])
        .join(";");
    const inner = chunk.map(({ el, m, style }) => `<g transform="matrix(${m.join(" ")})" style="${paint(style)}">${new XMLSerializer().serializeToString(el)}</g>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${F.width}" height="${F.height}" viewBox="0 0 ${F.width} ${F.height}">${defsMarkup}${inner}</svg>`;
    const r = await rasterize(svg, F.width, F.height, true);
    if (!r) return;
    artCount += 1;
    opts.onProgress?.(`Uploading artwork ${artCount}…`);
    const asset = await opts.upload(new File([r.blob], `artwork-${artCount}.png`, { type: "image/png" }), "overlay");
    nodes.push(newImage("overlay", { type: "asset", assetId: asset.id }, scene, { name: `Artwork ${artCount}`, x: r.box.x, y: r.box.y, width: r.box.width, height: r.box.height, fit: "contain" }));
  }

  async function addImage(el: Element, m: Mat, style: Style) {
    const href = el.getAttribute("href") ?? el.getAttributeNS("http://www.w3.org/1999/xlink", "href") ?? "";
    const name = nameFor(el, "Image");
    if (!href.startsWith("data:")) {
      warnings.push(`“${name}” links to an outside file, so it was skipped. Embed images when exporting (Illustrator: Images → Embed).`);
      return;
    }
    const x = parseFloat(el.getAttribute("x") ?? "0") || 0;
    const y = parseFloat(el.getAttribute("y") ?? "0") || 0;
    const w = parseFloat(el.getAttribute("width") ?? "0");
    const h = parseFloat(el.getAttribute("height") ?? "0");
    if (!(w > 0 && h > 0)) return;
    const [nx, ny] = apply(m, x, y);
    const width = Math.round(w * scaleX(m) * 10) / 10;
    const height = Math.round(h * scaleY(m) * 10) / 10;
    opts.onProgress?.(`Uploading ${name}…`);
    const fileOut = await dataUriToUpload(href, name);
    if (!fileOut) {
      warnings.push(`“${name}” couldn't be read and was skipped.`);
      return;
    }
    const covers = width * height >= F.width * F.height * 0.85;
    const role: Role = guessImageRole(name, covers);
    const asset = await opts.upload(fileOut, role === "background" ? "background" : role === "logo" ? "logo" : "overlay");
    images += 1;
    nodes.push(
      newImage(role, { type: "asset", assetId: asset.id }, scene, {
        name,
        x: Math.round(nx * 10) / 10,
        y: Math.round(ny * 10) / 10,
        width,
        height,
        rotation: rotationOf(m),
        opacity: opacityOf(style),
        fit: "cover",
        ...(role === "background" ? { locked: true, perms: { ...LOCKED_PERMS } } : {})
      })
    );
  }

  function addText(el: Element, m: Mat, style: Style) {
    // Lines: each tspan with its own y (or dy) starts a new line; tspans on the same line join.
    const spans = [...el.querySelectorAll("tspan")];
    const lines: { text: string; x: number; y: number }[] = [];
    const ox = parseFloat(el.getAttribute("x") ?? "0") || 0;
    const oy = parseFloat(el.getAttribute("y") ?? "0") || 0;
    if (!spans.length) lines.push({ text: el.textContent ?? "", x: ox, y: oy });
    let cy = oy;
    for (const sp of spans) {
      if (sp.querySelector("tspan")) continue;
      const hasY = sp.hasAttribute("y");
      const dy = parseFloat(sp.getAttribute("dy") ?? "0") || 0;
      const y = hasY ? parseFloat(sp.getAttribute("y")!) : cy + dy;
      const x = sp.hasAttribute("x") ? parseFloat(sp.getAttribute("x")!) : (lines[lines.length - 1]?.x ?? ox);
      const last = lines[lines.length - 1];
      if (last && Math.abs(last.y - y) < 0.5) last.text += sp.textContent ?? "";
      else lines.push({ text: sp.textContent ?? "", x, y });
      cy = y;
    }
    const words = lines.map((l) => l.text.replace(/\s+$/g, "")).join("\n");
    if (!words.trim()) return;
    const s = { ...style, ...styleOf(spans[0] ?? el, style) };
    const sx = scaleX(m);
    const fontSize = Math.round((px(s["font-size"]) ?? 16) * sx * 100) / 100;
    const font = matchFont(s["font-family"] ?? "Arial", weightOf(s["font-weight"]));
    const italic = /italic|oblique/.test(s["font-style"] ?? "") || /italic|oblique/i.test(s["font-family"] ?? "");
    const letterSpacing = Math.round((px(s["letter-spacing"], (px(s["font-size"]) ?? 16)) ?? 0) * sx * 100) / 100;
    const anchor = s["text-anchor"] === "middle" ? "center" : s["text-anchor"] === "end" ? "right" : "left";
    const lineHeight = lines.length > 1 ? Math.max(0.6, Math.min(3, Math.abs(lines[1].y - lines[0].y) * scaleY(m) / fontSize)) : 1;

    // Measure with the same font the canvas will use.
    measure.font = `${italic ? "italic " : ""}${font.weight} ${fontSize}px "${canvasFamily(font.key)}", sans-serif`;
    const widths = lines.map((l) => measure.measureText(l.text).width + letterSpacing * Math.max(0, l.text.length));
    const textW = Math.max(...widths, 1);
    const mm = measure.measureText("M");
    const ascent = mm.fontBoundingBoxAscent ?? fontSize * 0.9;
    const descent = mm.fontBoundingBoxDescent ?? fontSize * 0.21;
    const L = fontSize * lineHeight;

    // Room for longer booking details: the box reaches toward the canvas edge on the side
    // the text grows into, and single-line text shrinks to fit instead of wrapping.
    const edge = 24;
    const [bx, by] = apply(m, lines[0].x, lines[0].y);
    const natural = Math.ceil(textW + fontSize * 0.2);
    const room = anchor === "center" ? 2 * Math.max(0, Math.min(bx, F.width - bx) - edge) : anchor === "right" ? bx - edge : F.width - edge - bx;
    const boxW = Math.max(natural, Math.round(room));
    const x = anchor === "center" ? bx - boxW / 2 : anchor === "right" ? bx - boxW : bx;
    // Konva puts the first baseline at y + (ascent - descent)/2 + lineHeight/2.
    const y = by - (ascent - descent) / 2 - L / 2;

    const name = nameFor(el, "Text");
    const role = guessTextRole(name, words);
    const stroke = s.stroke && s.stroke !== "none" ? { enabled: true, color: toHex(s.stroke), width: Math.round((px(s["stroke-width"]) ?? 1) * sx * 10) / 10 } : { enabled: false, color: "#000000", width: 4 };
    texts += 1;
    nodes.push(
      newText(role, scene, {
        name,
        text: opts.placeholders ? suggestPlaceholder(role, words) : words,
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        width: boxW,
        height: Math.ceil(L * lines.length),
        rotation: rotationOf(m),
        opacity: opacityOf(s),
        font: font.key,
        weight: font.weight,
        italic,
        fontSize,
        lineHeight: Math.round(lineHeight * 100) / 100,
        letterSpacing,
        align: anchor,
        uppercase: isAllCaps(words),
        shrink: lines.length === 1,
        fill: s.fill === "none" ? "#00000000" : toHex(s.fill, "#000000"),
        stroke
      })
    );
  }

  async function walk(el: Element, m: Mat, parent: Style) {
    const tag = el.nodeName.toLowerCase().replace(/^svg:/, "");
    if (SKIP.has(tag)) return;
    const style = styleOf(el, parent);
    if (style.display === "none" || style.visibility === "hidden") return;
    const mm = multiply(m, parseTransform(el.getAttribute("transform")));
    if (tag === "text") {
      await flushArt();
      addText(el, mm, style);
    } else if (tag === "image") {
      await flushArt();
      await addImage(el, mm, style);
    } else if (tag === "g" || tag === "a" || tag === "svg") {
      // Group opacity applies to each child layer.
      const childStyle = { ...style, "opacity-inherit": String(opacityOf(style)) };
      for (const c of [...el.children]) await walk(c, tag === "svg" && el !== root ? multiply(mm, nestedSvg(el)) : mm, childStyle);
    } else if (SHAPES.has(tag)) {
      pending.push({ el, m, style: parent });
    }
  }

  opts.onProgress?.("Reading layers…");
  for (const c of [...root.children]) await walk(c, base, {});
  await flushArt();
  if (!texts) warnings.push("No live text was found. If the words were turned into outlines, export again with text kept as text (Illustrator: SVG Options → Font: SVG, not “Convert to outlines”).");

  return {
    scene: { version: 1, format, width: F.width, height: F.height, background: "#000000", safeMargin: 50, nodes: nodes.slice(0, 80) },
    warnings: nodes.length > 80 ? [...warnings, "Only the first 80 layers were imported."] : warnings,
    texts,
    images
  };
}

function opacityOf(s: Style): number {
  const own = parseFloat(s.opacity ?? "1");
  const inh = parseFloat(s["opacity-inherit"] ?? "1");
  const v = (Number.isFinite(own) ? own : 1) * (Number.isFinite(inh) ? inh : 1);
  return Math.max(0, Math.min(1, v));
}

function nestedSvg(el: Element): Mat {
  const x = parseFloat(el.getAttribute("x") ?? "0") || 0;
  const y = parseFloat(el.getAttribute("y") ?? "0") || 0;
  return [1, 0, 0, 1, x, y];
}

/** Embedded image → a file the server accepts (PNG/JPEG/WebP under 15 MB), converting only when needed. */
async function dataUriToUpload(uri: string, name: string): Promise<File | null> {
  const m = uri.match(/^data:([^;,]+)(;base64)?,([\s\S]*)$/);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  let bytes: Uint8Array;
  try {
    bytes = m[2] ? Uint8Array.from(atob(m[3].replace(/\s+/g, "")), (c) => c.charCodeAt(0)) : new TextEncoder().encode(decodeURIComponent(m[3]));
  } catch {
    return null;
  }
  const safe = name.replace(/[^\w -]+/g, "").trim() || "image";
  if (["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mime) && bytes.length <= 15 * 1024 * 1024) {
    return new File([bytes as BlobPart], `${safe}.${mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg"}`, { type: mime === "image/jpg" ? "image/jpeg" : mime });
  }
  // SVG, GIF or too large: draw it and re-save.
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: mime }));
  try {
    const img = await loadImg(url);
    const scale = Math.min(1, 4000 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round((img.naturalWidth || 1080) * scale));
    c.height = Math.max(1, Math.round((img.naturalHeight || 1080) * scale));
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    let blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/png"));
    if (blob && blob.size > 15 * 1024 * 1024) blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.9));
    return blob ? new File([blob], `${safe}.${blob.type === "image/png" ? "png" : "jpg"}`, { type: blob.type }) : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImg(url: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("image"));
    i.src = url;
  });
}

/** Draws vector artwork to a transparent PNG, trimmed to what's actually drawn. */
async function rasterize(svg: string, w: number, h: number, trim: boolean): Promise<{ blob: Blob; box: { x: number; y: number; width: number; height: number } } | null> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const img = await loadImg(url);
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, w, h);
    let box = { x: 0, y: 0, width: w, height: h };
    if (trim) {
      const data = ctx.getImageData(0, 0, w, h).data;
      let minX = w, minY = h, maxX = -1, maxY = -1;
      for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++)
          if (data[(y * w + x) * 4 + 3] > 2) {
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
      if (maxX < 0) return null; // nothing visible
      box = { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
    }
    const out = document.createElement("canvas");
    out.width = Math.max(64, box.width);
    out.height = Math.max(64, box.height);
    out.getContext("2d")!.drawImage(c, box.x, box.y, box.width, box.height, 0, 0, box.width, box.height);
    const blob = await new Promise<Blob | null>((r) => out.toBlob(r, "image/png"));
    if (!blob) return null;
    return { blob, box: { ...box, width: out.width, height: out.height } };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

