"use client";

import { useState } from "react";
import { ArrowLeftRight, Brush, Check, ChevronDown, Eraser, Eye, Layers, Redo2, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { MaskFade } from "@/lib/flyers/mask";
import type { MaskTool } from "./mask-tools";
import { FOCUS, iconBtn, labelCls, Slider } from "./editor-panels";

export type MaskApi = {
  name: string;
  tool: MaskTool;
  setTool: (t: MaskTool) => void;
  brush: { size: number; hardness: number; opacity: number };
  setBrush: (b: Partial<{ size: number; hardness: number; opacity: number }>) => void;
  maxSize: number;
  fadeType: "linear" | "radial";
  setFadeType: (t: "linear" | "radial") => void;
  fade: MaskFade | null;
  /** A ready-made fade (bottom edge for linear, centre for radial). */
  addFade: (t: "linear" | "radial") => void;
  setFade: (f: MaskFade | null) => void;
  feather: number;
  setFeather: (v: number) => void;
  overlay: boolean;
  setOverlay: (v: boolean) => void;
  hold: (v: boolean) => void;
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  reset: () => void;
  cancel: () => void;
  apply: () => void;
  dirty: boolean;
  hasEdits: boolean;
};

const TOOLS: { k: MaskTool; label: string; Icon: typeof Brush; hint: string }[] = [
  { k: "hide", label: "Hide", Icon: Eraser, hint: "Paint over parts to hide" },
  { k: "restore", label: "Restore", Icon: Brush, hint: "Paint to bring parts back" },
  { k: "fade", label: "Fade", Icon: Layers, hint: "Drag across the picture to fade it out" }
];

/**
 * Mask controls. Desktop: in the properties panel. Phone: a compact bar under
 * the canvas (tools, size, apply) with the rest one tap away.
 */
export function MaskPanel({ api, compact }: { api: MaskApi; compact?: boolean }) {
  const [more, setMore] = useState(false);
  const holdProps = {
    onPointerDown: (e: React.PointerEvent) => {
      e.currentTarget.setPointerCapture?.(e.pointerId);
      api.hold(true);
    },
    onPointerUp: () => api.hold(false),
    onPointerCancel: () => api.hold(false),
    onPointerLeave: () => api.hold(false),
    onKeyDown: (e: React.KeyboardEvent) => (e.key === " " || e.key === "Enter") && api.hold(true),
    onKeyUp: () => api.hold(false),
    onContextMenu: (e: React.MouseEvent) => e.preventDefault()
  };
  const tools = (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Mask tool" data-tour="mask-tools">
      {TOOLS.map(({ k, label, Icon, hint }) => (
        <button key={k} role="radio" aria-checked={api.tool === k} title={hint} className={cn(iconBtn, "h-10 justify-center", api.tool === k && "border-gold bg-gold-soft")} onClick={() => api.setTool(k)}>
          <Icon size={15} /> {label}
        </button>
      ))}
    </div>
  );
  const size = (
    <Slider label="Brush size" value={Math.round(api.brush.size)} min={2} max={api.maxSize} step={1} display={`${Math.round(api.brush.size)} px`} onChange={(v) => api.setBrush({ size: v })} />
  );
  const brushMore = (
    <>
      <Slider label="Hardness" value={Math.round(api.brush.hardness * 100)} min={0} max={100} step={1} display={`${Math.round(api.brush.hardness * 100)}%`} onChange={(v) => api.setBrush({ hardness: v / 100 })} />
      <Slider label="Opacity" value={Math.round(api.brush.opacity * 100)} min={5} max={100} step={1} display={`${Math.round(api.brush.opacity * 100)}%`} onChange={(v) => api.setBrush({ opacity: v / 100 })} />
    </>
  );
  const fadeControls = (
    <div className="flex flex-col gap-2" data-tour="mask-fade">
      <div className="grid grid-cols-2 gap-1.5" role="radiogroup" aria-label="Fade shape">
        {(["linear", "radial"] as const).map((t) => (
          <button
            key={t}
            role="radio"
            aria-checked={(api.fade?.type ?? api.fadeType) === t}
            className={cn(iconBtn, "justify-center", (api.fade?.type ?? api.fadeType) === t && "border-gold bg-gold-soft")}
            onClick={() => {
              api.setFadeType(t);
              if (api.fade && api.fade.type !== t) api.setFade({ ...api.fade, type: t });
            }}
          >
            {t === "linear" ? "Linear" : "Radial"}
          </button>
        ))}
      </div>
      {api.fade ? (
        <div className="flex gap-1.5">
          <button className={cn(iconBtn, "flex-1 justify-center", api.fade.reverse && "border-gold bg-gold-soft")} aria-pressed={api.fade.reverse} onClick={() => api.setFade({ ...api.fade!, reverse: !api.fade!.reverse })}>
            <ArrowLeftRight size={14} /> Reverse
          </button>
          <button className={cn(iconBtn, "flex-1 justify-center")} onClick={() => api.setFade(null)}>
            <Trash2 size={14} /> Remove fade
          </button>
        </div>
      ) : (
        <button className={cn(iconBtn, "justify-center")} onClick={() => api.addFade(api.fadeType)}>
          Add {api.fadeType === "linear" ? "a fade at the bottom" : "a round fade"}
        </button>
      )}
      <p className="text-[11px] leading-snug text-muted">
        {api.fade ? "Drag the solid dot (fully shown) or the hollow dot (fully hidden). Drag elsewhere to draw a new fade." : "Drag across the picture from the part to keep toward the part to fade out."} Brush work stays as it is.
      </p>
    </div>
  );
  const view = (
    <div className="flex gap-1.5">
      <button className={cn(iconBtn, "flex-1 justify-center", api.overlay && "border-gold bg-gold-soft")} aria-pressed={api.overlay} onClick={() => api.setOverlay(!api.overlay)} data-tour="mask-overlay">
        <span className="h-3 w-3 rounded-sm bg-[#ff2d6f]/70" aria-hidden /> Show hidden
      </button>
      <button className={cn(iconBtn, "flex-1 select-none justify-center [touch-action:none]")} {...holdProps} aria-label="Hold to see the original picture" data-tour="mask-hold">
        <Eye size={14} /> Hold: original
      </button>
    </div>
  );
  const history = (
    <div className="flex gap-1.5">
      <button className={cn(iconBtn, "flex-1")} disabled={!api.canUndo} onClick={api.undo} aria-label="Undo mask step">
        <Undo2 size={14} /> {!compact && "Undo"}
      </button>
      <button className={cn(iconBtn, "flex-1")} disabled={!api.canRedo} onClick={api.redo} aria-label="Redo mask step">
        <Redo2 size={14} /> {!compact && "Redo"}
      </button>
      <button className={cn(iconBtn, "flex-1")} disabled={!api.hasEdits} onClick={api.reset} title="Clear every brush stroke and fade (the picture's own transparency stays)">
        <RotateCcw size={14} /> Reset
      </button>
    </div>
  );
  const actions = (
    <div className="flex gap-1.5" data-tour="mask-apply">
      <button className={cn(iconBtn, "h-10 flex-1 justify-center")} onClick={api.cancel}>
        <X size={15} /> Cancel
      </button>
      <button className={cn(iconBtn, "h-10 flex-1 justify-center border-gold bg-[#c99428] font-semibold text-white hover:bg-[#b5841f]")} onClick={api.apply}>
        <Check size={15} /> Apply
      </button>
    </div>
  );

  if (compact)
    return (
      <div className="flex flex-col gap-2 border-t border-black/10 bg-[var(--card)] px-3 pb-[calc(8px+env(safe-area-inset-bottom))] pt-2" role="region" aria-label={`Mask: ${api.name}`} data-tour="mask-panel">
        {tools}
        {api.tool === "fade" ? fadeControls : size}
        {more && (
          <div className="flex flex-col gap-2">
            {api.tool !== "fade" && brushMore}
            <Slider label="Edge feather" value={Math.round(api.feather * 1000)} min={0} max={100} step={1} display={`${Math.round(api.feather * 1000)}`} onChange={(v) => api.setFeather(v / 1000)} />
            {view}
          </div>
        )}
        <div className="flex gap-1.5">
          <div className="flex-[3]">{history}</div>
          <button className={cn(iconBtn, "flex-1", more && "border-gold bg-gold-soft")} aria-expanded={more} onClick={() => setMore((v) => !v)} data-tour="mask-more">
            More <ChevronDown size={13} className={cn("transition-transform", more && "rotate-180")} />
          </button>
        </div>
        {actions}
      </div>
    );

  return (
    <div className="flex flex-col gap-3 p-4" role="region" aria-label={`Mask: ${api.name}`} data-tour="mask-panel">
      <div>
        <p className="text-sm font-semibold">Mask</p>
        <p className="truncate text-xs text-muted">{api.name}</p>
      </div>
      {tools}
      {api.tool === "fade" ? (
        fadeControls
      ) : (
        <div className="flex flex-col gap-2">
          {size}
          {brushMore}
        </div>
      )}
      <div>
        <Slider label="Edge feather" value={Math.round(api.feather * 1000)} min={0} max={100} step={1} display={`${Math.round(api.feather * 1000)}`} onChange={(v) => api.setFeather(v / 1000)} />
        <span className="mt-1 block text-[11px] text-muted">Softens every masked edge.</span>
      </div>
      <div>
        <span className={labelCls}>View</span>
        {view}
      </div>
      {history}
      {actions}
      <p className="text-[11px] leading-snug text-muted">
        Nothing is cut from the photo: the mask only hides it, so you can bring any part back later. It moves, turns, flips and crops with the layer. Ctrl/⌘ Z steps back one stroke.
      </p>
      <span className={cn("sr-only", FOCUS)} aria-live="polite">
        {api.dirty ? "Mask has unapplied changes" : ""}
      </span>
    </div>
  );
}
