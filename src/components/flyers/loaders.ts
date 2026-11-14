"use client";

import { useEffect, useState } from "react";
import { canvasFamily, fontFaces, hasItalic, nearestWeight } from "@/lib/flyers/fonts";
import type { ImageSource, Scene } from "@/lib/flyers/types";

/* ---------------- fonts ---------------- */

const fontLoads = new Map<string, Promise<void>>();

/** Registers (once) and loads one font file. Resolves even if the file fails, so the editor never hangs. */
function loadFace(f: ReturnType<typeof fontFaces>[number]): Promise<void> {
  const k = `${f.family}|${f.weight}|${f.style}`;
  if (!fontLoads.has(k)) {
    fontLoads.set(
      k,
      (async () => {
        try {
          const face = new FontFace(f.family, `url(${f.url}) format("woff2")`, { weight: String(f.weight), style: f.style, display: "block" });
          document.fonts.add(face);
          await face.load();
        } catch {
          /* fall back to the browser default */
        }
      })()
    );
  }
  return fontLoads.get(k)!;
}

/** Loads exactly the font files a scene uses (all of them when `all`). */
export function loadSceneFonts(scenes: (Scene | undefined)[], all = false): Promise<void> {
  const faces = fontFaces();
  const wanted = all
    ? faces
    : faces.filter((f) =>
        scenes.some((s) =>
          s?.nodes.some((n) => n.kind === "text" && canvasFamily(n.font) === f.family && nearestWeight(n.font, n.weight) === f.weight && (f.style === "italic") === (n.italic && hasItalic(n.font, n.weight)))
        )
      );
  return Promise.all(wanted.map(loadFace)).then(() => undefined);
}

export function fontString(n: { font: string; weight: number; italic: boolean }) {
  const w = nearestWeight(n.font, n.weight);
  return { family: canvasFamily(n.font), style: `${n.italic && hasItalic(n.font, w) ? "italic " : ""}${w}` };
}

/* ---------------- images ---------------- */

export type SrcContext = { previewDjId?: string | null };

/** Same-origin URL for an image source (so the canvas can be exported), or null when there's nothing to show. */
export function srcFor(source: ImageSource, ctx: SrcContext = {}): string | null {
  switch (source.type) {
    case "asset":
      return `/api/flyers/assets/${source.assetId}`;
    case "static":
      return source.src;
    case "dj_photo": {
      const id = source.djId ?? ctx.previewDjId;
      return id ? `/api/flyers/photo/${id}` : null;
    }
    case "venue_logo":
      return source.venueId ? `/api/flyers/venue-logo/${source.venueId}` : null;
    default:
      return null;
  }
}

type Loaded = { img: HTMLImageElement | null; failed: boolean };
const imageLoads = new Map<string, Promise<Loaded>>();

export function loadImage(url: string): Promise<Loaded> {
  if (!imageLoads.has(url)) {
    imageLoads.set(
      url,
      new Promise<Loaded>((resolve) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.decoding = "async";
        img.onload = () => resolve({ img, failed: false });
        img.onerror = () => {
          imageLoads.delete(url); // allow a retry later (e.g. after a photo is added)
          resolve({ img: null, failed: true });
        };
        img.src = url;
      })
    );
  }
  return imageLoads.get(url)!;
}

/** Forget a cached image (after the DJ changes their profile photo, for example). */
export function forgetImage(url: string) {
  imageLoads.delete(url);
}

export function useImage(url: string | null): { img: HTMLImageElement | null; status: "loading" | "ready" | "failed" | "none" } {
  const [state, setState] = useState<{ url: string | null; img: HTMLImageElement | null; status: "loading" | "ready" | "failed" | "none" }>({ url: null, img: null, status: "none" });
  useEffect(() => {
    let live = true;
    if (!url) return;
    loadImage(url).then((r) => {
      if (live) setState({ url, img: r.img, status: r.failed ? "failed" : "ready" });
    });
    return () => {
      live = false;
    };
  }, [url]);
  if (!url) return { img: null, status: "none" };
  if (state.url !== url) return { img: null, status: "loading" };
  return { img: state.img, status: state.status };
}

/** Waits until every image in the scene has loaded (or failed), so an export never misses one. */
export async function loadSceneImages(scene: Scene, ctx: SrcContext = {}) {
  const urls = scene.nodes.flatMap((n) => (n.kind === "image" && n.visible ? [srcFor(n.source, ctx)] : [])).filter((u): u is string => !!u);
  await Promise.all(urls.map(loadImage));
}
