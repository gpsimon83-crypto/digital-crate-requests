"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import type Konva from "konva";
import { Group, Layer, Rect, Stage } from "react-konva";
import { Muxer, ArrayBufferTarget } from "mp4-muxer";
import { SceneNodes } from "../flyer-canvas";
import { loadSceneFonts, loadSceneImages, type SrcContext } from "../loaders";
import type { Scene } from "@/lib/flyers/types";
import { evaluateFrame, frameCount, frameTime } from "@/lib/flyers/motion/engine";
import type { Animation } from "@/lib/flyers/motion/types";
import type { Framing } from "@/lib/flyers/motion/formats";

/**
 * MP4 export, frame by frame (never a real-time screen recording):
 * the flyer is drawn off screen at full size with the same layers and the
 * same motion evaluation as the preview, for frames i = 0 … N−1 at
 * t = i / fps, and each frame is encoded with the browser's H.264 encoder
 * (WebCodecs) into an MP4 with the index at the front ("fast start") and
 * no audio track.
 */

export type ExportProgress = { phase: "preparing" | "rendering" | "finishing" | "done" | "error" | "cancelled"; frame: number; frames: number; message?: string; blob?: Blob; codec?: string };

const CODECS = ["avc1.640028", "avc1.4d0028", "avc1.42e028"]; // High, Main, Baseline (level 4.0)

/** H.264 config this browser can encode at this size, or null. */
export async function pickCodec(width: number, height: number, fps: number): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === "undefined") return null;
  for (const codec of CODECS) {
    const cfg: VideoEncoderConfig = { codec, width, height, framerate: fps, bitrate: Math.round(width * height * fps * 0.22), latencyMode: "quality", avc: { format: "avc" } };
    try {
      if ((await VideoEncoder.isConfigSupported(cfg)).supported) return cfg;
    } catch {
      // try the next
    }
  }
  return null;
}

const yieldFrame = () => new Promise<void>((r) => setTimeout(r, 0));

export function VideoRenderer({ scene, ctx: ctxIn, anim, onProgress, cancelRef, out }: { scene: Scene; ctx: SrcContext; anim: Animation; onProgress: (p: ExportProgress) => void; cancelRef: React.RefObject<boolean>; /** Output size and how the flyer sits in it (other formats); default: the flyer's own size. */ out?: Framing }) {
  const F: Framing = out ?? { width: scene.width, height: scene.height, scale: 1, ox: 0, oy: 0 };
  const ctx = useMemo(() => ({ ...ctxIn, fxScale: 1 }), [ctxIn]);
  const stageRef = useRef<Konva.Stage>(null);
  const [t, setT] = useState(0);
  const [ready, setReady] = useState(false);
  const pending = useRef(new Map<string, boolean>());
  const [tick, setTick] = useState(0);
  const started = useRef(false);
  const report = useRef(onProgress);
  useEffect(() => {
    report.current = onProgress;
  });
  const N = frameCount(anim);
  const motion = useMemo(() => evaluateFrame(scene, anim, t), [scene, anim, t]);
  const imageIds = useMemo(() => scene.nodes.filter((n) => n.kind === "image" && n.visible).map((n) => n.id), [scene.nodes]);
  const onStatus = useMemo(
    () => (id: string, done: boolean) => {
      pending.current.set(id, done);
      setTick((x) => x + 1);
    },
    []
  );

  // Fonts and pictures first: text is measured with the real fonts.
  useEffect(() => {
    let live = true;
    report.current({ phase: "preparing", frame: 0, frames: N });
    Promise.all([loadSceneFonts([scene]), loadSceneImages(scene, ctx), document.fonts.ready])
      .then(() => live && setReady(true))
      .catch(() => live && report.current({ phase: "error", frame: 0, frames: N, message: "A font or picture couldn't load. Check your connection and try again." }));
    return () => {
      live = false;
    };
  }, [scene, ctx, N]);

  useEffect(() => {
    if (!ready || started.current) return;
    if (!imageIds.every((id) => pending.current.get(id))) return;
    started.current = true;
    void (async () => {
      const W = F.width;
      const H = F.height;
      let encoder: VideoEncoder | null = null;
      try {
        const cfg = await pickCodec(W, H, anim.fps);
        if (!cfg) throw new Error("This browser can't make MP4 video. Use a recent Chrome, Edge or Safari (17+).");
        const muxer = new Muxer({ target: new ArrayBufferTarget(), video: { codec: "avc", width: W, height: H, frameRate: anim.fps }, fastStart: "in-memory", firstTimestampBehavior: "offset" });
        let encErr: Error | null = null;
        encoder = new VideoEncoder({ output: (chunk, meta) => muxer.addVideoChunk(chunk, meta), error: (e) => (encErr = e as Error) });
        encoder.configure(cfg);
        // Flat frames (video has no transparency): the flyer on its background colour.
        const flat = document.createElement("canvas");
        flat.width = W;
        flat.height = H;
        const fc = flat.getContext("2d", { willReadFrequently: true })!;
        const us = 1_000_000 / anim.fps;
        for (let i = 0; i < N; i++) {
          if (cancelRef.current) {
            encoder.close();
            report.current({ phase: "cancelled", frame: i, frames: N });
            return;
          }
          // Exact timeline time for this frame (the last frame is N−1; t = duration is never drawn).
          flushSync(() => setT(frameTime(anim, i)));
          await yieldFrame();
          const stage = stageRef.current;
          if (!stage) throw new Error("The flyer couldn't be drawn.");
          stage.draw();
          let canvas: HTMLCanvasElement;
          try {
            canvas = stage.toCanvas({ pixelRatio: 1, x: 0, y: 0, width: W, height: H });
          } catch {
            throw new Error("A picture on this flyer can't be exported (it comes from another site). Replace it and try again.");
          }
          fc.fillStyle = scene.background;
          fc.fillRect(0, 0, W, H);
          fc.drawImage(canvas, 0, 0);
          // Pixels handed over as BT.709 video range (what phones and social apps expect), not full-range sRGB.
          const px = fc.getImageData(0, 0, W, H).data;
          const frame = new VideoFrame(px, { format: "RGBX", codedWidth: W, codedHeight: H, timestamp: Math.round(i * us), duration: Math.round(us), colorSpace: { primaries: "bt709", transfer: "bt709", matrix: "bt709", fullRange: false } });
          encoder.encode(frame, { keyFrame: i % (anim.fps * 2) === 0 });
          frame.close();
          if (encErr) throw encErr;
          // Keep memory bounded: let the encoder catch up.
          while (encoder.encodeQueueSize > 6) await yieldFrame();
          if (i % 3 === 0 || i === N - 1) report.current({ phase: "rendering", frame: i + 1, frames: N, codec: cfg.codec });
        }
        report.current({ phase: "finishing", frame: N, frames: N, codec: cfg.codec });
        await encoder.flush();
        if (encErr) throw encErr;
        encoder.close();
        encoder = null;
        muxer.finalize();
        const blob = new Blob([muxer.target.buffer], { type: "video/mp4" });
        report.current({ phase: "done", frame: N, frames: N, blob, codec: cfg.codec });
      } catch (e) {
        try {
          encoder?.close();
        } catch {
          // already closed
        }
        report.current({ phase: "error", frame: 0, frames: N, message: e instanceof Error ? e.message : "The video couldn't be made." });
      }
    })();
  }, [ready, tick, imageIds, scene, anim, N, cancelRef, F.width, F.height, F.ox, F.oy, F.scale]);

  if (!ready) return null;
  return (
    <div aria-hidden style={{ position: "fixed", left: -30000, top: 0, width: F.width, height: F.height, pointerEvents: "none", opacity: 0 }}>
      <Stage ref={stageRef} width={F.width} height={F.height}>
        <Layer>
          <Rect width={F.width} height={F.height} fill={scene.background} />
          <Group x={F.ox} y={F.oy} scaleX={F.scale} scaleY={F.scale} clipX={0} clipY={0} clipWidth={scene.width} clipHeight={scene.height}>
            <SceneNodes scene={scene} ctx={ctx} exporting act={null} fontsKey={1} onStatus={onStatus} motion={motion} />
          </Group>
        </Layer>
      </Stage>
    </div>
  );
}
