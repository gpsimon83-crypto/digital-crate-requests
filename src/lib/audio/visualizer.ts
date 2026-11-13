/**
 * Canvas spectrum visualizer for the floating player.
 *
 * Driven only by real analyser data: thin log-spaced bars rising from a
 * baseline, a dimmer mirrored reflection, amber→gold gradients with cyan
 * accents on strong bars, and a thin spectral contour. When analysis isn't
 * available (no Web Audio, or audio the browser won't let us read) it shows a
 * still, dimmed placeholder instead of fake motion.
 *
 * Rendering stops when paused (after the bars settle), minimized, or the tab
 * is hidden; sizing follows the element via ResizeObserver at device pixel ratio.
 */
import { bandBins, bandLevels, barCountFor, smoothLevels, type Band } from "./spectrum";

export type VisualizerSource = {
  analyser: () => AnalyserNode | null;
  playing: () => boolean;
};

export class SpectrumVisualizer {
  private ctx: CanvasRenderingContext2D | null;
  private w = 0;
  private h = 0;
  private n = 0;
  private bands: Band[] = [];
  private bandsFor = "";
  private cur = new Float32Array(0);
  private target = new Float32Array(0);
  private peaks = new Float32Array(0);
  private data: Uint8Array<ArrayBuffer> | null = null;
  private raf = 0;
  private last = 0;
  private lastDraw = 0;
  private silentSince = 0;
  private fallback = false;
  private minimized = false;
  private reduced = false;
  private ro: ResizeObserver | null = null;
  private mq: MediaQueryList | null = null;

  constructor(private canvas: HTMLCanvasElement, private src: VisualizerSource) {
    this.ctx = canvas.getContext("2d");
    this.mq = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    this.reduced = !!this.mq?.matches;
    this.mq?.addEventListener?.("change", this.onMotion);
    if (typeof ResizeObserver !== "undefined") {
      this.ro = new ResizeObserver(() => this.resize());
      this.ro.observe(canvas);
    }
    document.addEventListener("visibilitychange", this.onVisibility);
    this.resize();
  }

  /** Whether the last frames had no readable audio (shows the still placeholder). */
  get isFallback() {
    return this.fallback;
  }

  /** Call on play, track change or resume. */
  wake() {
    this.silentSince = 0;
    if (!this.raf && !this.minimized && !document.hidden) {
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.frame);
    }
  }

  setMinimized(on: boolean) {
    this.minimized = on;
    if (on) this.halt();
    else this.wake();
  }

  destroy() {
    this.halt();
    this.ro?.disconnect();
    this.mq?.removeEventListener?.("change", this.onMotion);
    document.removeEventListener("visibilitychange", this.onVisibility);
  }

  private halt() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private onVisibility = () => {
    if (document.hidden) this.halt();
    else this.wake();
  };

  private onMotion = () => {
    this.reduced = !!this.mq?.matches;
    this.wake();
  };

  private resize() {
    const r = this.canvas.getBoundingClientRect();
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    this.w = Math.max(1, r.width);
    this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
    const n = barCountFor(this.w);
    if (n !== this.n) {
      this.n = n;
      this.cur = new Float32Array(n);
      this.target = new Float32Array(n);
      this.peaks = new Float32Array(n);
      this.bandsFor = "";
    }
    this.draw();
    this.wake();
  }

  private frame = (t: number) => {
    this.raf = 0;
    const dt = Math.min(0.1, (t - this.last) / 1000);
    this.last = t;
    const playing = this.src.playing();
    const analyser = playing ? this.src.analyser() : null;

    if (playing && analyser) {
      const bins = analyser.frequencyBinCount;
      if (!this.data || this.data.length !== bins) this.data = new Uint8Array(bins);
      const key = `${this.n}:${bins}:${analyser.context.sampleRate}`;
      if (key !== this.bandsFor) {
        this.bands = bandBins(this.n, bins, analyser.context.sampleRate);
        this.bandsFor = key;
      }
      analyser.getByteFrequencyData(this.data);
      let any = 0;
      for (let i = 0; i < this.data.length; i += 8) any |= this.data[i];
      // Playing but nothing readable for a while (e.g. audio from a host that blocks analysis): placeholder.
      if (!any) {
        if (!this.silentSince) this.silentSince = t;
        if (t - this.silentSince > 2500) this.fallback = true;
      } else {
        this.silentSince = 0;
        this.fallback = false;
      }
      bandLevels(this.data, this.bands, this.target);
    } else {
      if (playing && !analyser) this.fallback = true;
      this.target.fill(0);
    }

    if (this.reduced) {
      // Reduced motion: no animated easing; refresh a few times a second at most.
      if (t - this.lastDraw >= 250 || !playing) {
        this.cur.set(this.target);
        this.peaks.set(this.target);
        this.lastDraw = t;
        this.draw();
      }
    } else {
      smoothLevels(this.cur, this.target, dt);
      for (let i = 0; i < this.n; i++) this.peaks[i] = Math.max(this.cur[i], this.peaks[i] - dt * 0.32);
      this.draw();
    }

    let settled = true;
    for (let i = 0; i < this.n; i++) if (this.cur[i] > 0.002 || this.peaks[i] > 0.002) { settled = false; break; }
    if ((playing || !settled) && !this.minimized && !document.hidden) this.raf = requestAnimationFrame(this.frame);
  };

  private draw() {
    const c = this.ctx;
    if (!c) return;
    const { w: W, h: H, n } = this;
    c.clearRect(0, 0, W, H);
    if (!n) return;
    const y0 = Math.round(H * 0.64) + 0.5;
    const up = y0 - 3;
    const down = H - y0 - 1;
    const slot = W / n;
    const bw = Math.max(1.2, slot * 0.46);
    const still = this.fallback;
    const level = (i: number) => (still ? 0.08 + 0.16 * Math.pow(Math.sin(Math.PI * (i + 0.5) / n), 2) * (0.7 + 0.3 * Math.cos(i * 0.9)) : this.cur[i]);

    // Bars (one path, filled twice: a soft glow, then crisp).
    const bars = new Path2D();
    const refl = new Path2D();
    for (let i = 0; i < n; i++) {
      const v = level(i);
      const x = i * slot + (slot - bw) / 2;
      const hUp = Math.max(1, v * up);
      bars.rect(x, y0 - hUp, bw, hUp);
      refl.rect(x, y0 + 1, bw, Math.max(0.5, v * down * 0.8));
    }
    const g = c.createLinearGradient(0, y0, 0, y0 - up);
    g.addColorStop(0, "#8a4f12");
    g.addColorStop(0.42, "#e39a2c");
    g.addColorStop(0.78, "#ffcf6a");
    g.addColorStop(1, "#fff1c4");
    c.save();
    c.globalAlpha = still ? 0.28 : 1;
    if (!this.reduced && !still) {
      c.shadowColor = "rgba(255,168,56,0.55)";
      c.shadowBlur = 10;
    }
    c.fillStyle = g;
    c.fill(bars);
    c.restore();

    // Reflection: dimmer, fading down, a touch of cyan.
    const rg = c.createLinearGradient(0, y0, 0, H);
    rg.addColorStop(0, still ? "rgba(227,154,44,0.12)" : "rgba(227,154,44,0.38)");
    rg.addColorStop(0.55, "rgba(70,170,200,0.10)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = rg;
    c.fill(refl);

    if (!still) {
      // Cyan accents on strong bars and their falling peaks.
      for (let i = 0; i < n; i++) {
        const v = this.cur[i];
        const x = i * slot + (slot - bw) / 2;
        if (v > 0.32) {
          c.fillStyle = `rgba(110,226,255,${Math.min(0.9, (v - 0.3) * 1.5).toFixed(3)})`;
          c.fillRect(x, y0 - v * up, bw, 2);
        }
        const p = this.peaks[i];
        if (p > 0.3 && p - v > 0.08) {
          c.fillStyle = `rgba(150,236,255,${Math.min(0.55, p * 0.7).toFixed(3)})`;
          c.fillRect(x, y0 - p * up - 3, bw, 1.2);
        }
      }
      // Thin spectral contour over the bar tops.
      c.save();
      c.beginPath();
      for (let i = 0; i < n; i++) {
        const x = i * slot + slot / 2;
        const y = y0 - (this.cur[i] * up + 3);
        if (i === 0) c.moveTo(x, y);
        else {
          const px = (i - 1) * slot + slot / 2;
          const py = y0 - (this.cur[i - 1] * up + 3);
          c.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2);
        }
      }
      c.strokeStyle = "rgba(255,214,140,0.55)";
      c.lineWidth = 1.1;
      if (!this.reduced) {
        c.shadowColor = "rgba(255,190,90,0.6)";
        c.shadowBlur = 6;
      }
      c.stroke();
      c.restore();
    }

    // Baseline.
    const bl = c.createLinearGradient(0, 0, W, 0);
    bl.addColorStop(0, "rgba(229,182,71,0)");
    bl.addColorStop(0.5, "rgba(255,214,140,0.7)");
    bl.addColorStop(1, "rgba(229,182,71,0)");
    c.fillStyle = bl;
    c.fillRect(0, y0 - 0.5, W, 1);

    // Soft fade at both ends.
    c.save();
    c.globalCompositeOperation = "destination-in";
    const fade = c.createLinearGradient(0, 0, W, 0);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(0.07, "rgba(0,0,0,1)");
    fade.addColorStop(0.93, "rgba(0,0,0,1)");
    fade.addColorStop(1, "rgba(0,0,0,0)");
    c.fillStyle = fade;
    c.fillRect(0, 0, W, H);
    c.restore();
  }
}
