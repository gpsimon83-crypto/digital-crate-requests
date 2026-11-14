"use client";

import { useId, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  ChevronsDown,
  ChevronsUp,
  Copy,
  Eye,
  EyeOff,
  FlipHorizontal2,
  FlipVertical2,
  Folder,
  FolderOpen,
  Group as GroupIcon,
  ImagePlus,
  Lock,
  Search,
  Trash2,
  Type,
  Ungroup,
  Unlock,
  Upload,
  UserSquare2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FLYER_FONTS, fontByKey, nearestWeight } from "@/lib/flyers/fonts";
import { featherOn } from "@/lib/flyers/feather";
import { PLACEHOLDERS, ROLES, type FlyerNode, type ImageNode, type ImageSource, type Perms, type Role, type Scene, type TextNode } from "@/lib/flyers/types";

export type Asset = { id: string; kind: string; name: string | null; folder?: string | null; width: number; height: number; has_alpha: boolean };
export type VenueOpt = { id: string; name: string; has_logo: boolean };

export const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-1";
export const inputCls = cn("w-full rounded-[8px] border border-black/12 bg-white px-2.5 py-1.5 text-sm text-foreground disabled:opacity-50", FOCUS);
const labelCls = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted";
export const iconBtn = cn("inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-[8px] border border-black/10 bg-white px-2 text-xs text-foreground hover:border-gold disabled:pointer-events-none disabled:opacity-40", FOCUS);

/* ---------------- small controls ---------------- */

function Num({ label, value, onChange, min, max, step = 1, disabled, suffix }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; disabled?: boolean; suffix?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          className={cn(inputCls, suffix && "pr-7")}
          value={Number.isFinite(value) ? Math.round(value * 100) / 100 : 0}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onChange(min !== undefined || max !== undefined ? Math.min(max ?? v, Math.max(min ?? v, v)) : v);
          }}
        />
        {suffix && <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted">{suffix}</span>}
      </div>
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step, disabled, display }: { label: string; value: number; onChange: (v: number) => void; min: number; max: number; step: number; disabled?: boolean; display?: string }) {
  const id = useId();
  return (
    <div>
      <div className="flex items-center justify-between">
        <label htmlFor={id} className={labelCls}>
          {label}
        </label>
        <span className="text-[11px] tabular-nums text-muted">{display ?? value}</span>
      </div>
      <input id={id} type="range" className={cn("w-full accent-[#c99428]", FOCUS)} min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(parseFloat(e.target.value))} />
    </div>
  );
}

function ColorField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const id = useId();
  const [text, setText] = useState(value);
  const [last, setLast] = useState(value);
  if (value !== last) {
    setLast(value);
    setText(value);
  }
  return (
    <div>
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      <div className="flex items-center gap-1.5">
        <input type="color" aria-label={`${label} picker`} className={cn("h-8 w-9 shrink-0 cursor-pointer rounded border border-black/12 bg-white p-0.5", FOCUS)} value={value.length === 7 ? value : "#000000"} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
        <input
          id={id}
          className={cn(inputCls, "font-mono text-xs")}
          value={text}
          disabled={disabled}
          maxLength={9}
          onChange={(e) => {
            setText(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value);
          }}
        />
      </div>
    </div>
  );
}

function Check({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("flex min-h-8 cursor-pointer items-center gap-2 text-sm", disabled && "cursor-not-allowed opacity-50")}>
      <input type="checkbox" className={cn("h-4 w-4 accent-[#c99428]", FOCUS)} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

function Section({ title, children, defaultOpen = true }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="group border-b border-black/8 py-3 last:border-0">
      <summary className={cn("flex cursor-pointer list-none items-center justify-between rounded text-xs font-semibold uppercase tracking-wide text-foreground", FOCUS)}>
        {title}
        <span className="text-muted transition-transform group-open:rotate-180" aria-hidden>
          ▾
        </span>
      </summary>
      <div className="mt-3 flex flex-col gap-3">{children}</div>
    </details>
  );
}

/* ---------------- properties ---------------- */

export type PropsApi = {
  mode: "design" | "template";
  can: (n: FlyerNode, a: keyof Perms) => boolean;
  update: (id: string, patch: Partial<FlyerNode>, key: string) => void;
  remove: () => void;
  duplicate: () => void;
  reorder: (dir: "up" | "down" | "top" | "bottom") => void;
  openReplace: (id: string) => void;
};

export function PropertiesPanel({ scene, node, multi, api, sceneControls, textRef }: { scene: Scene; node: FlyerNode | null; multi: number; api: PropsApi; sceneControls: React.ReactNode; textRef: React.RefObject<HTMLTextAreaElement | null> }) {
  if (!node) {
    return (
      <div className="flex flex-col gap-3 p-4">
        <p className="text-sm font-semibold">{multi > 1 ? `${multi} layers selected` : "Flyer"}</p>
        {multi > 1 ? (
          <div className="flex flex-wrap gap-2">
            <button className={iconBtn} onClick={api.duplicate}>
              <Copy size={14} /> Duplicate
            </button>
            <button className={iconBtn} onClick={api.remove}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        ) : (
          <p className="text-xs text-muted">Select a layer on the flyer or in Layers to edit it. Tip: double-click text to edit the wording.</p>
        )}
        {sceneControls}
      </div>
    );
  }

  const n = node;
  const canMove = api.can(n, "move") && !n.locked;
  const canStyle = api.can(n, "style");
  const canEdit = api.can(n, "edit");
  const set = (patch: Partial<FlyerNode>, key = Object.keys(patch).join(",")) => api.update(n.id, patch, `${n.id}:${key}`);

  return (
    <div className="flex flex-col px-4 pb-6">
      <div className="sticky top-0 z-10 -mx-4 flex items-center gap-2 border-b border-black/8 bg-[var(--card)] px-4 py-3">
        <span className="truncate text-sm font-semibold">{n.name}</span>
        <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">{ROLES[n.role]}</span>
      </div>
      {api.mode === "design" && (!api.can(n, "move") || !api.can(n, "edit") || !api.can(n, "style")) && (
        <p className="mt-3 rounded-[8px] bg-black/5 px-3 py-2 text-xs text-muted">Parts of this layer are fixed by the template.</p>
      )}

      {n.kind === "text" && <TextProps n={n} set={set} canEdit={canEdit} canStyle={canStyle} mode={api.mode} textRef={textRef} />}
      {n.kind === "image" && <ImageProps n={n} set={set} canEdit={canEdit} canStyle={canStyle} api={api} />}

      <Section title="Position & size">
        <div className="grid grid-cols-2 gap-2">
          <Num label="X" value={n.x} onChange={(v) => set({ x: v }, "x")} disabled={!canMove} suffix="px" />
          <Num label="Y" value={n.y} onChange={(v) => set({ y: v }, "y")} disabled={!canMove} suffix="px" />
          <Num label="Width" value={n.width} min={8} max={8000} onChange={(v) => set({ width: v }, "width")} disabled={!canMove} suffix="px" />
          {n.kind === "image" ? <Num label="Height" value={n.height} min={8} max={8000} onChange={(v) => set({ height: v }, "height")} disabled={!canMove} suffix="px" /> : <div />}
          <Num label="Rotation" value={n.rotation} min={-360} max={360} onChange={(v) => set({ rotation: v }, "rotation")} disabled={!canMove} suffix="°" />
          <div className="flex items-end">
            <button className={cn(iconBtn, "w-full")} disabled={!canMove} onClick={() => set({ x: Math.round((scene.width - n.width) / 2) }, "x")}>
              Center horizontally
            </button>
          </div>
        </div>
        <Slider label="Opacity" value={Math.round(n.opacity * 100)} min={0} max={100} step={1} display={`${Math.round(n.opacity * 100)}%`} disabled={!canStyle} onChange={(v) => set({ opacity: v / 100 }, "opacity")} />
      </Section>

      <Section title="Arrange">
        <div className="grid grid-cols-4 gap-1.5">
          <button className={iconBtn} onClick={() => api.reorder("top")} aria-label="Bring to front" title="Bring to front">
            <ChevronsUp size={15} />
          </button>
          <button className={iconBtn} onClick={() => api.reorder("up")} aria-label="Bring forward" title="Bring forward">
            <ArrowUp size={15} />
          </button>
          <button className={iconBtn} onClick={() => api.reorder("down")} aria-label="Send backward" title="Send backward">
            <ArrowDown size={15} />
          </button>
          <button className={iconBtn} onClick={() => api.reorder("bottom")} aria-label="Send to back" title="Send to back">
            <ChevronsDown size={15} />
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button className={iconBtn} onClick={api.duplicate}>
            <Copy size={14} /> Duplicate
          </button>
          <button className={iconBtn} onClick={() => set({ locked: !n.locked }, "locked")}>
            {n.locked ? <Unlock size={14} /> : <Lock size={14} />} {n.locked ? "Unlock" : "Lock"}
          </button>
          <button className={iconBtn} disabled={!canEdit} onClick={() => set({ visible: !n.visible }, "visible")}>
            {n.visible ? <EyeOff size={14} /> : <Eye size={14} />} {n.visible ? "Hide" : "Show"}
          </button>
          <button className={cn(iconBtn, "text-status-declined")} disabled={!api.can(n, "remove")} onClick={api.remove}>
            <Trash2 size={14} /> Delete
          </button>
        </div>
      </Section>

      {api.mode === "template" && <TemplatePermsSection n={n} set={set} />}
    </div>
  );
}

function TextProps({ n, set, canEdit, canStyle, mode, textRef }: { n: TextNode; set: (p: Partial<TextNode>, k?: string) => void; canEdit: boolean; canStyle: boolean; mode: "design" | "template"; textRef: React.RefObject<HTMLTextAreaElement | null> }) {
  const id = useId();
  const font = fontByKey(n.font);
  return (
    <>
      <Section title="Text">
        <div>
          <label htmlFor={id} className={labelCls}>
            Wording
          </label>
          <textarea id={id} ref={textRef} className={cn(inputCls, "min-h-[76px] resize-y")} value={n.text} disabled={!canEdit} maxLength={500} onChange={(e) => set({ text: e.target.value }, "text")} />
        </div>
        {mode === "template" && (
          <label className="block">
            <span className={labelCls}>Insert placeholder</span>
            <select
              className={inputCls}
              value=""
              onChange={(e) => {
                if (e.target.value) set({ text: `${n.text}${n.text && !n.text.endsWith(" ") ? " " : ""}{{${e.target.value}}}` }, "text");
              }}
            >
              <option value="">Choose…</option>
              {Object.entries(PLACEHOLDERS).map(([k, l]) => (
                <option key={k} value={k}>
                  {l} — {`{{${k}}}`}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-[11px] text-muted">Add a fallback after a bar: {"{{end_time|Close}}"}.</span>
          </label>
        )}
      </Section>
      <Section title="Font">
        <label className="block">
          <span className={labelCls}>Font family</span>
          <select className={inputCls} value={n.font} disabled={!canStyle} onChange={(e) => set({ font: e.target.value, weight: nearestWeight(e.target.value, n.weight) }, "font")}>
            {FLYER_FONTS.map((f) => (
              <option key={f.key} value={f.key}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className={labelCls}>Weight</span>
            <select className={inputCls} value={nearestWeight(n.font, n.weight)} disabled={!canStyle || font.weights.length < 2} onChange={(e) => set({ weight: parseInt(e.target.value, 10) }, "weight")}>
              {font.weights.map((w) => (
                <option key={w} value={w}>
                  {{ 400: "Regular", 600: "Semibold", 700: "Bold", 800: "Extra bold", 900: "Black" }[w] ?? w}
                </option>
              ))}
            </select>
          </label>
          <Num label="Size" value={n.fontSize} min={6} max={600} onChange={(v) => set({ fontSize: v }, "fontSize")} disabled={!canStyle} suffix="px" />
          <Num label="Line spacing" value={n.lineHeight} min={0.6} max={3} step={0.05} onChange={(v) => set({ lineHeight: v }, "lineHeight")} disabled={!canStyle} />
          <Num label="Letter spacing" value={n.letterSpacing} min={-20} max={80} step={0.5} onChange={(v) => set({ letterSpacing: v }, "letterSpacing")} disabled={!canStyle} suffix="px" />
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Text alignment">
          {(["left", "center", "right"] as const).map((a) => {
            const Icon = a === "left" ? AlignLeft : a === "center" ? AlignCenter : AlignRight;
            return (
              <button key={a} className={cn(iconBtn, n.align === a && "border-gold bg-gold-soft")} aria-pressed={n.align === a} aria-label={`Align ${a}`} disabled={!canStyle} onClick={() => set({ align: a }, "align")}>
                <Icon size={15} />
              </button>
            );
          })}
          <button className={cn(iconBtn, n.uppercase && "border-gold bg-gold-soft")} aria-pressed={n.uppercase} disabled={!canStyle} onClick={() => set({ uppercase: !n.uppercase }, "uppercase")}>
            AA
          </button>
          {font.italic?.length ? (
            <button className={cn(iconBtn, "italic", n.italic && "border-gold bg-gold-soft")} aria-pressed={n.italic} disabled={!canStyle} onClick={() => set({ italic: !n.italic }, "italic")}>
              Italic
            </button>
          ) : null}
        </div>
        <Check label="Shrink to fit on one line" checked={n.shrink} disabled={!canStyle} onChange={(v) => set({ shrink: v }, "shrink")} />
        <ColorField label="Color" value={n.fill} disabled={!canStyle} onChange={(v) => set({ fill: v }, "fill")} />
      </Section>
      <Section title="Outline" defaultOpen={n.stroke.enabled}>
        <Check label="Outline" checked={n.stroke.enabled} disabled={!canStyle} onChange={(v) => set({ stroke: { ...n.stroke, enabled: v } }, "stroke")} />
        {n.stroke.enabled && (
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Outline color" value={n.stroke.color} disabled={!canStyle} onChange={(v) => set({ stroke: { ...n.stroke, color: v } }, "stroke")} />
            <Num label="Thickness" value={n.stroke.width} min={0} max={60} onChange={(v) => set({ stroke: { ...n.stroke, width: v } }, "stroke")} disabled={!canStyle} suffix="px" />
          </div>
        )}
      </Section>
      <ShadowSection value={n.shadow} disabled={!canStyle} onChange={(s) => set({ shadow: s }, "shadow")} />
    </>
  );
}

function ShadowSection({ value, onChange, disabled }: { value: TextNode["shadow"]; onChange: (s: TextNode["shadow"]) => void; disabled: boolean }) {
  return (
    <Section title="Shadow & glow" defaultOpen={value.enabled}>
      <Check label="Shadow" checked={value.enabled} disabled={disabled} onChange={(v) => onChange({ ...value, enabled: v })} />
      {value.enabled && (
        <>
          <ColorField label="Shadow color" value={value.color} disabled={disabled} onChange={(v) => onChange({ ...value, color: v })} />
          <Slider label="Blur" value={value.blur} min={0} max={120} step={1} disabled={disabled} onChange={(v) => onChange({ ...value, blur: v })} />
          <Slider label="Strength" value={Math.round(value.opacity * 100)} display={`${Math.round(value.opacity * 100)}%`} min={0} max={100} step={1} disabled={disabled} onChange={(v) => onChange({ ...value, opacity: v / 100 })} />
          <div className="grid grid-cols-2 gap-2">
            <Num label="Offset X" value={value.offsetX} min={-200} max={200} onChange={(v) => onChange({ ...value, offsetX: v })} disabled={disabled} />
            <Num label="Offset Y" value={value.offsetY} min={-200} max={200} onChange={(v) => onChange({ ...value, offsetY: v })} disabled={disabled} />
          </div>
        </>
      )}
    </Section>
  );
}

function ImageProps({ n, set, canEdit, canStyle, api }: { n: ImageNode; set: (p: Partial<ImageNode>, k?: string) => void; canEdit: boolean; canStyle: boolean; api: PropsApi }) {
  return (
    <>
      <Section title="Image">
        <button className={cn(iconBtn, "w-full justify-center")} disabled={!canEdit} onClick={() => api.openReplace(n.id)}>
          <ImagePlus size={15} /> Replace image (keeps the frame)
        </button>
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Fit">
          {(["cover", "contain"] as const).map((f) => (
            <button key={f} className={cn(iconBtn, n.fit === f && "border-gold bg-gold-soft")} aria-pressed={n.fit === f} disabled={!canStyle} onClick={() => set({ fit: f, crop: { zoom: 1, x: 0, y: 0 } }, "fit")}>
              {f === "cover" ? "Fill frame" : "Fit whole image"}
            </button>
          ))}
        </div>
      </Section>
      <Section title="Crop">
        <Slider label="Zoom" value={n.crop.zoom} min={1} max={6} step={0.01} display={`${Math.round(n.crop.zoom * 100)}%`} disabled={!canStyle} onChange={(v) => set({ crop: { ...n.crop, zoom: v } }, "crop")} />
        <Slider label="Left / right" value={n.crop.x} min={-1} max={1} step={0.01} display={`${Math.round(n.crop.x * 100)}`} disabled={!canStyle} onChange={(v) => set({ crop: { ...n.crop, x: v } }, "crop")} />
        <Slider label="Up / down" value={n.crop.y} min={-1} max={1} step={0.01} display={`${Math.round(n.crop.y * 100)}`} disabled={!canStyle} onChange={(v) => set({ crop: { ...n.crop, y: v } }, "crop")} />
        <div className="flex flex-wrap gap-1.5">
          <button className={cn(iconBtn, n.flipX && "border-gold bg-gold-soft")} aria-pressed={n.flipX} disabled={!canStyle} onClick={() => set({ flipX: !n.flipX }, "flipX")}>
            <FlipHorizontal2 size={15} /> Flip
          </button>
          <button className={cn(iconBtn, n.flipY && "border-gold bg-gold-soft")} aria-pressed={n.flipY} disabled={!canStyle} onClick={() => set({ flipY: !n.flipY }, "flipY")}>
            <FlipVertical2 size={15} /> Flip vertical
          </button>
          <button className={iconBtn} disabled={!canStyle} onClick={() => set({ crop: { zoom: 1, x: 0, y: 0 } }, "crop")}>
            Reset crop
          </button>
        </div>
        <p className="text-[11px] text-muted">The original image is kept as uploaded; cropping only changes this layer.</p>
      </Section>
      <Section title="Color" defaultOpen={(n.recolor?.mode ?? "none") !== "none" || !!n.recolor?.knockoutWhite}>
        <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Recolor">
          {(
            [
              ["none", "Original"],
              ["solid", "Solid color"],
              ["tint", "Tint"]
            ] as const
          ).map(([m, l]) => (
            <button key={m} className={cn(iconBtn, (n.recolor?.mode ?? "none") === m && "border-gold bg-gold-soft")} aria-pressed={(n.recolor?.mode ?? "none") === m} disabled={!canStyle} onClick={() => set({ recolor: { color: n.recolor?.color ?? "#ffffff", knockoutWhite: n.recolor?.knockoutWhite ?? false, mode: m } }, "recolor")}>
              {l}
            </button>
          ))}
        </div>
        {(n.recolor?.mode ?? "none") !== "none" && (
          <>
            <ColorField label={n.recolor?.mode === "tint" ? "Tint color" : "New color"} value={n.recolor?.color ?? "#ffffff"} disabled={!canStyle} onChange={(v) => set({ recolor: { ...n.recolor!, color: v } }, "recolor")} />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick colors">
              {["#ffffff", "#000000", "#e5b647", "#c99428", "#cb171a", "#7c4dff", "#ff4fa3", "#2aa6a0"].map((c) => (
                <button key={c} className={cn("h-7 w-7 rounded-full border border-black/15", FOCUS, n.recolor?.color === c && "ring-2 ring-gold ring-offset-1")} style={{ background: c }} aria-label={`Use ${c}`} disabled={!canStyle} onClick={() => set({ recolor: { ...n.recolor!, color: c } }, "recolor")} />
              ))}
            </div>
          </>
        )}
        <Check label="Remove white background" checked={!!n.recolor?.knockoutWhite} disabled={!canStyle} onChange={(v) => set({ recolor: { mode: n.recolor?.mode ?? "none", color: n.recolor?.color ?? "#ffffff", knockoutWhite: v } }, "recolor")} />
        <p className="text-[11px] text-muted">Solid color repaints a one-color logo (like an all-black logo) in any color, keeping its shape. Tint colors a photo but keeps its light and shade. For logos saved on a white box, also tick “Remove white background”.</p>
      </Section>
      <FeatherSection n={n} canStyle={canStyle} set={set} />
      <Section title="Frame" defaultOpen={n.frame.enabled}>
        <Check label="Frame border" checked={n.frame.enabled} disabled={!canStyle} onChange={(v) => set({ frame: { ...n.frame, enabled: v } }, "frame")} />
        {n.frame.enabled && (
          <div className="grid grid-cols-2 gap-2">
            <ColorField label="Frame color" value={n.frame.color} disabled={!canStyle} onChange={(v) => set({ frame: { ...n.frame, color: v } }, "frame")} />
            <Num label="Thickness" value={n.frame.width} min={0} max={80} onChange={(v) => set({ frame: { ...n.frame, width: v } }, "frame")} disabled={!canStyle} suffix="px" />
          </div>
        )}
        <Slider label="Rounded corners" value={n.frame.radius} min={0} max={Math.round(Math.min(n.width, n.height) / 2)} step={1} disabled={!canStyle} onChange={(v) => set({ frame: { ...n.frame, radius: v } }, "frame")} />
      </Section>
      <ShadowSection value={n.shadow} disabled={!canStyle} onChange={(s) => set({ shadow: s }, "shadow")} />
    </>
  );
}

function TemplatePermsSection({ n, set }: { n: FlyerNode; set: (p: Partial<FlyerNode>, k?: string) => void }) {
  const p = n.perms;
  const all = p.move && p.edit && p.style && p.remove;
  const none = !p.move && !p.edit && !p.style && !p.remove;
  return (
    <Section title="Template settings">
      <label className="block">
        <span className={labelCls}>Layer type</span>
        <select className={inputCls} value={n.role} onChange={(e) => set({ role: e.target.value as Role }, "role")}>
          {Object.entries(ROLES)
            .filter(([k]) => (n.kind === "text" ? !["background", "portrait", "logo", "overlay", "image"].includes(k) : ["background", "portrait", "logo", "overlay", "image"].includes(k)))
            .map(([k, l]) => (
              <option key={k} value={k}>
                {l}
              </option>
            ))}
        </select>
      </label>
      <label className="block">
        <span className={labelCls}>Layer name</span>
        <input className={inputCls} value={n.name} maxLength={60} onChange={(e) => set({ name: e.target.value }, "name")} />
      </label>
      <fieldset>
        <legend className={labelCls}>DJs can</legend>
        <div className="grid grid-cols-2">
          <Check label="Move & resize" checked={p.move} onChange={(v) => set({ perms: { ...p, move: v } }, "perms")} />
          <Check label={n.kind === "text" ? "Edit wording" : "Replace image"} checked={p.edit} onChange={(v) => set({ perms: { ...p, edit: v } }, "perms")} />
          <Check label="Change style" checked={p.style} onChange={(v) => set({ perms: { ...p, style: v } }, "perms")} />
          <Check label="Delete" checked={p.remove} onChange={(v) => set({ perms: { ...p, remove: v } }, "perms")} />
        </div>
      </fieldset>
      <div className="flex gap-1.5">
        <button className={iconBtn} disabled={none} onClick={() => set({ perms: { move: false, edit: false, style: false, remove: false } }, "perms")}>
          <Lock size={14} /> Lock for DJs
        </button>
        <button className={iconBtn} disabled={all} onClick={() => set({ perms: { move: true, edit: true, style: true, remove: true } }, "perms")}>
          <Unlock size={14} /> Allow everything
        </button>
      </div>
    </Section>
  );
}

/* ---------------- layers ---------------- */

export function LayersPanel({
  scene,
  selected,
  onSelect,
  update,
  reorderOne,
  group,
  ungroup,
  can
}: {
  scene: Scene;
  selected: string[];
  onSelect: (id: string, additive: boolean) => void;
  update: (id: string, patch: Partial<FlyerNode>, key: string) => void;
  reorderOne: (id: string, dir: "up" | "down") => void;
  group: () => void;
  ungroup: () => void;
  can: (n: FlyerNode, a: keyof Perms) => boolean;
}) {
  const [renaming, setRenaming] = useState<string | null>(null);
  const list = [...scene.nodes].reverse();
  const selNodes = scene.nodes.filter((n) => selected.includes(n.id));
  const groupColors = new Map<string, string>();
  const palette = ["#c99428", "#7c4dff", "#e2557b", "#2aa6a0", "#4c86ff"];
  scene.nodes.forEach((n) => n.groupId && !groupColors.has(n.groupId) && groupColors.set(n.groupId, palette[groupColors.size % palette.length]));
  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-black/8 px-4 py-3">
        <p className="text-sm font-semibold">Layers</p>
        <div className="flex gap-1.5">
          <button className={iconBtn} disabled={selNodes.length < 2} onClick={group} title="Group selected layers">
            <GroupIcon size={14} /> Group
          </button>
          <button className={iconBtn} disabled={!selNodes.some((n) => n.groupId)} onClick={ungroup} title="Ungroup">
            <Ungroup size={14} /> Ungroup
          </button>
        </div>
      </div>
      <p className="px-4 pt-2 text-[11px] text-muted">Top of the list is the front. Shift-click to select several.</p>
      <ul className="flex flex-col gap-1 p-2" aria-label="Layers, front to back">
        {list.map((n, i) => {
          const sel = selected.includes(n.id);
          const Icon = n.kind === "text" ? Type : n.role === "portrait" ? UserSquare2 : ImagePlus;
          return (
            <li key={n.id} className={cn("flex items-center gap-1 rounded-[8px] border px-1.5 py-1", sel ? "border-gold bg-gold-soft/60" : "border-transparent hover:bg-black/[0.03]")}>
              {n.groupId && <span className="h-6 w-1 shrink-0 rounded-full" style={{ background: groupColors.get(n.groupId) }} title="Grouped" />}
              <button className={cn("flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded px-1 text-left text-sm", FOCUS, !n.visible && "opacity-50")} aria-pressed={sel} onClick={(e) => onSelect(n.id, e.shiftKey || e.metaKey || e.ctrlKey)} onDoubleClick={() => setRenaming(n.id)}>
                <Icon size={14} className="shrink-0 text-muted" aria-hidden />
                {renaming === n.id ? (
                  <input
                    autoFocus
                    className={inputCls}
                    defaultValue={n.name}
                    maxLength={60}
                    aria-label="Layer name"
                    onClick={(e) => e.stopPropagation()}
                    onBlur={(e) => {
                      update(n.id, { name: e.target.value.trim() || n.name }, `${n.id}:name`);
                      setRenaming(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                      if (e.key === "Escape") setRenaming(null);
                    }}
                  />
                ) : (
                  <span className="truncate">{n.name}</span>
                )}
              </button>
              <button className={cn(iconBtn, "h-8 min-w-8 border-transparent bg-transparent")} aria-label={n.visible ? `Hide ${n.name}` : `Show ${n.name}`} disabled={!can(n, "edit")} onClick={() => update(n.id, { visible: !n.visible }, `${n.id}:visible`)}>
                {n.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <button className={cn(iconBtn, "h-8 min-w-8 border-transparent bg-transparent", n.locked && "text-gold-dim")} aria-label={n.locked ? `Unlock ${n.name}` : `Lock ${n.name}`} aria-pressed={n.locked} onClick={() => update(n.id, { locked: !n.locked }, `${n.id}:locked`)}>
                {n.locked ? <Lock size={14} /> : <Unlock size={14} />}
              </button>
              <button className={cn(iconBtn, "h-8 min-w-8 border-transparent bg-transparent")} aria-label={`Move ${n.name} forward`} disabled={i === 0} onClick={() => reorderOne(n.id, "up")}>
                <ArrowUp size={14} />
              </button>
              <button className={cn(iconBtn, "h-8 min-w-8 border-transparent bg-transparent")} aria-label={`Move ${n.name} backward`} disabled={i === list.length - 1} onClick={() => reorderOne(n.id, "down")}>
                <ArrowDown size={14} />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ---------------- library: add text, photos, logos, assets ---------------- */

export type LibraryApi = {
  mode: "design" | "template";
  addText: (role: Role) => void;
  placeImage: (source: ImageSource, role: Role, asset?: Asset) => void;
  upload: (file: File, kind: string) => Promise<void>;
  /** Delete one of the images listed (asks first, and again if it's in use). */
  deleteAsset?: (a: Asset) => void;
  /** Where the full library (folders, rename, bulk delete) lives. */
  libraryHref?: string;
  replacing: string | null;
  /** Import a layered SVG (Illustrator, Figma, Canva…) as editable layers. */
  importSvg?: (file: File, placeholders: boolean) => Promise<void>;
  cancelReplace: () => void;
};

const thumb = (src: string, alt: string) => (
  // eslint-disable-next-line @next/next/no-img-element
  <img src={src} alt={alt} loading="lazy" className="h-full w-full object-contain" />
);

export function LibraryPanel({
  tab,
  setTab,
  api,
  owner,
  uploads,
  shared,
  venues,
  templatesSlot
}: {
  tab: string;
  setTab: (t: string) => void;
  api: LibraryApi;
  owner: { id: string; display_name: string; has_photo: boolean } | null;
  uploads: Asset[];
  shared: Asset[];
  venues: VenueOpt[];
  templatesSlot?: React.ReactNode;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState(api.mode === "template" ? "background" : "photo");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [find, setFind] = useState("");
  const match = (a: Asset) => {
    const n = find.trim().toLowerCase();
    return !n || (a.name ?? "").toLowerCase().includes(n) || (a.folder ?? "").toLowerCase().includes(n);
  };
  const searchBox = (
    <label className="relative block">
      <span className="sr-only">Search images</span>
      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      <input className={cn(inputCls, "pl-8")} placeholder="Search images or folders" value={find} onChange={(e) => setFind(e.target.value)} />
    </label>
  );
  const manageLink = api.libraryHref ? (
    <a href={api.libraryHref} target="_blank" rel="noreferrer" className={cn("inline-flex items-center gap-1 self-start text-xs font-medium text-gold-dim underline underline-offset-2", FOCUS)}>
      <FolderOpen size={13} /> Organise or delete images
    </a>
  ) : null;
  const tabs = [...(templatesSlot ? [["templates", "Templates"]] : []), ["text", "Text"], ["photos", "Photos"], ["logos", "Logos"], ["assets", api.mode === "template" ? "Assets" : "Art"]] as [string, string][];

  async function onFile(f: File | undefined) {
    if (!f) return;
    setErr(null);
    setBusy(true);
    try {
      await api.upload(f, kind);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const tile = cn("group relative flex aspect-square items-center justify-center overflow-hidden rounded-[10px] border border-black/10 bg-[repeating-conic-gradient(#eee_0_25%,#fff_0_50%)] bg-[length:16px_16px] p-1 hover:border-gold", FOCUS);

  return (
    <div className="flex h-full flex-col">
      <div role="tablist" aria-label="Add to flyer" className="flex gap-1 overflow-x-auto border-b border-black/8 px-2 pt-2">
        {tabs.map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={cn("shrink-0 rounded-t-[8px] px-3 py-2 text-xs font-semibold", FOCUS, tab === k ? "bg-gold-soft text-foreground" : "text-muted hover:text-foreground")} onClick={() => setTab(k)}>
            {l}
          </button>
        ))}
      </div>
      {api.replacing && (
        <div className="m-3 flex items-center justify-between gap-2 rounded-[8px] bg-gold-soft px-3 py-2 text-xs">
          <span>Pick an image to put in the selected frame.</span>
          <button className="font-semibold underline" onClick={api.cancelReplace}>
            Cancel
          </button>
        </div>
      )}
      <div className="flex-1 overflow-y-auto p-3">
        {tab === "templates" && templatesSlot}
        {tab === "text" && (
          <div className="flex flex-col gap-2">
            {(["title", "dj_name", "date", "time", "venue", "address", "details", "text"] as Role[]).map((r) => (
              <button key={r} className={cn(iconBtn, "h-11 justify-start px-3 text-sm")} onClick={() => api.addText(r)}>
                <Type size={15} className="text-muted" /> Add {ROLES[r].toLowerCase()}
              </button>
            ))}
            <p className="text-[11px] text-muted">{api.mode === "template" ? "New text starts with a placeholder like {{event_title}}. DJs see it filled from their booking." : "Every text box is its own layer: move it anywhere."}</p>
          </div>
        )}
        {tab === "photos" && (
          <div className="flex flex-col gap-3">
            {api.mode === "template" ? (
              <button className={cn(iconBtn, "h-11 justify-start px-3 text-sm")} onClick={() => api.placeImage({ type: "dj_photo" }, "portrait")}>
                <UserSquare2 size={15} /> Add DJ photo slot
              </button>
            ) : owner ? (
              <div>
                <p className={labelCls}>Saved profile photo</p>
                {owner.has_photo ? (
                  <button className={cn(tile, "w-1/2")} onClick={() => api.placeImage({ type: "dj_photo", djId: owner.id }, "portrait")} aria-label={`Use ${owner.display_name}'s profile photo`}>
                    {thumb(`/api/flyers/photo/${owner.id}`, `${owner.display_name}'s profile photo`)}
                  </button>
                ) : (
                  <p className="text-xs text-muted">No profile photo yet. Add one in My Profile, or upload one here.</p>
                )}
              </div>
            ) : null}
            {api.mode === "design" && (
              <>
                {uploads.length > 4 && searchBox}
                {uploads.length ? (
                  <AssetGrid items={uploads.filter(match)} title="Your uploads" tile={tile} onPick={(a) => api.placeImage({ type: "asset", assetId: a.id }, a.kind === "photo" ? "portrait" : "image", a)} onDelete={api.deleteAsset} />
                ) : (
                  <p className="text-xs text-muted">Nothing uploaded yet.</p>
                )}
                {uploads.length > 0 && manageLink}
                <UploadBox fileRef={fileRef} busy={busy} onFile={onFile} kind={kind} setKind={setKind} kinds={[["photo", "Photo of me"], ["image", "Other image"]]} />
                <p className="rounded-[8px] bg-black/5 p-2.5 text-[11px] leading-relaxed text-muted">
                  <b className="text-foreground">Cut-out portraits:</b>{" "}automatic background removal isn&apos;t available here. To place yourself without a background, upload a PNG that already has a transparent background (remove it first in an app like Photoshop, Canva or remove.bg). Transparent PNGs keep their transparency on the flyer.
                </p>
              </>
            )}
          </div>
        )}
        {tab === "logos" && (
          <div className="flex flex-col gap-3">
            {api.mode === "template" && (
              <button className={cn(iconBtn, "h-11 justify-start px-3 text-sm")} onClick={() => api.placeImage({ type: "venue_logo" }, "logo")}>
                <ImagePlus size={15} /> Add venue logo slot (filled from the booking)
              </button>
            )}
            <p className={labelCls}>Venue logos</p>
            <div className="grid grid-cols-3 gap-2">
              {venues
                .filter((v) => v.has_logo)
                .map((v) => (
                  <button key={v.id} className={tile} onClick={() => api.placeImage({ type: "venue_logo", venueId: v.id }, "logo")} aria-label={`Use ${v.name} logo`} title={v.name}>
                    {thumb(`/api/flyers/venue-logo/${v.id}`, `${v.name} logo`)}
                  </button>
                ))}
            </div>
            {!venues.some((v) => v.has_logo) && <p className="text-xs text-muted">No venue logos yet. They come from Admin → Venue Portals → Branding.</p>}
            <AssetGrid items={shared.filter((a) => a.kind === "logo" && match(a))} title="Logos" tile={tile} onPick={(a) => api.placeImage({ type: "asset", assetId: a.id }, "logo", a)} onDelete={api.mode === "template" ? api.deleteAsset : undefined} />
          </div>
        )}
        {tab === "assets" && (
          <div className="flex flex-col gap-3">
            {api.importSvg && <SvgImportBox mode={api.mode} onImport={api.importSvg} />}
            {shared.length > 4 && searchBox}
            <AssetGrid items={shared.filter((a) => a.kind === "background" && match(a))} title="Backgrounds" tile={tile} onPick={(a) => api.placeImage({ type: "asset", assetId: a.id }, "background", a)} onDelete={api.mode === "template" ? api.deleteAsset : undefined} />
            <AssetGrid items={shared.filter((a) => (a.kind === "overlay" || a.kind === "image") && match(a))} title="Overlays & art" tile={tile} onPick={(a) => api.placeImage({ type: "asset", assetId: a.id }, a.kind === "overlay" ? "overlay" : "image", a)} onDelete={api.mode === "template" ? api.deleteAsset : undefined} />
            {api.mode === "template" && manageLink}
            <div>
              <p className={labelCls}>Built-in</p>
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["/flyers/sample/gold-halo.png", "Gold halo", "overlay"],
                  ["/flyers/sample/sparks.png", "Sparkles", "overlay"],
                  ["/flyers/sample/club-night-square.jpg", "Club lights (square)", "background"],
                  ["/flyers/sample/club-night-portrait.jpg", "Club lights (portrait)", "background"],
                  ["/flyers/sample/club-night-story.jpg", "Club lights (story)", "background"]
                ].map(([src, name, r]) => (
                  <button key={src} className={tile} onClick={() => api.placeImage({ type: "static", src }, r as Role)} aria-label={`Use ${name}`} title={name}>
                    {thumb(src, name)}
                  </button>
                ))}
              </div>
            </div>
            {api.mode === "template" && (
              <UploadBox
                fileRef={fileRef}
                busy={busy}
                onFile={onFile}
                kind={kind}
                setKind={setKind}
                kinds={[
                  ["background", "Background (no text)"],
                  ["overlay", "Decorative overlay (PNG)"],
                  ["logo", "Logo"],
                  ["image", "Other image"]
                ]}
              />
            )}
          </div>
        )}
        {err && (
          <p role="alert" className="mt-3 text-xs text-status-declined">
            {err}
          </p>
        )}
      </div>
    </div>
  );
}

/** Images grouped by folder (images not in a folder first). */
function AssetGrid({ items, title, tile, onPick, onDelete }: { items: Asset[]; title: string; tile: string; onPick: (a: Asset) => void; onDelete?: (a: Asset) => void }) {
  if (!items.length) return null;
  const groups = new Map<string, Asset[]>();
  for (const a of items) groups.set(a.folder ?? "", [...(groups.get(a.folder ?? "") ?? []), a]);
  const keys = [...groups.keys()].sort((a, b) => (a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)));
  const grid = (list: Asset[]) => (
    <div className="grid grid-cols-3 gap-2">
      {list.map((a) => (
        <div key={a.id} className="group/t relative">
          <button className={tile} onClick={() => onPick(a)} aria-label={`Use ${a.name ?? title}`} title={a.name ?? undefined}>
            {thumb(`/api/flyers/assets/${a.id}`, a.name ?? title)}
          </button>
          {onDelete && (
            <button
              className={cn("absolute -right-1 -top-1 grid h-6 w-6 place-items-center rounded-full border border-black/10 bg-white text-muted shadow hover:text-status-declined focus-visible:opacity-100 sm:opacity-0 sm:group-hover/t:opacity-100", FOCUS)}
              aria-label={`Delete ${a.name ?? "image"}`}
              onClick={() => onDelete(a)}
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
  return (
    <div>
      <p className={labelCls}>{title}</p>
      {keys.length === 1 && keys[0] === ""
        ? grid(items)
        : keys.map((k) => (
            <details key={k || "none"} open className="mb-2">
              <summary className={cn("mb-1.5 flex cursor-pointer items-center gap-1.5 rounded text-xs font-medium", FOCUS)}>
                <Folder size={13} className="text-gold-dim" /> {k || "Not in a folder"} <span className="text-muted">({groups.get(k)!.length})</span>
              </summary>
              {grid(groups.get(k)!)}
            </details>
          ))}
    </div>
  );
}

function UploadBox({ fileRef, busy, onFile, kind, setKind, kinds }: { fileRef: React.RefObject<HTMLInputElement | null>; busy: boolean; onFile: (f: File | undefined) => void; kind: string; setKind: (k: string) => void; kinds: [string, string][] }) {
  const id = useId();
  return (
    <div className="rounded-[10px] border border-dashed border-black/20 p-3">
      <label htmlFor={`${id}-k`} className={labelCls}>
        Upload as
      </label>
      <select id={`${id}-k`} className={cn(inputCls, "mb-2")} value={kind} onChange={(e) => setKind(e.target.value)}>
        {kinds.map(([k, l]) => (
          <option key={k} value={k}>
            {l}
          </option>
        ))}
      </select>
      <input ref={fileRef} id={id} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} />
      <label htmlFor={id} className={cn(iconBtn, "h-10 w-full cursor-pointer justify-center", busy && "pointer-events-none opacity-50")}>
        <Upload size={15} /> {busy ? "Uploading…" : "Choose image"}
      </label>
      <p className="mt-1.5 text-[11px] text-muted">PNG, JPEG or WebP. Up to 10 MB (15 MB for template art).</p>
    </div>
  );
}

function SvgImportBox({ mode, onImport }: { mode: "design" | "template"; onImport: (file: File, placeholders: boolean) => Promise<void> }) {
  const id = useId();
  const ref = useRef<HTMLInputElement>(null);
  const [placeholders, setPlaceholders] = useState(mode === "template");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div className="rounded-[10px] border border-gold/40 bg-gold-soft/40 p-3">
      <p className="text-sm font-semibold">Import a layered SVG</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted">
        From Illustrator, Figma, Canva or Inkscape. Each text becomes its own editable layer; embedded pictures become image layers. It replaces the layers in this size.
      </p>
      {mode === "template" && (
        <label className="mt-2 flex items-start gap-2 text-xs">
          <input type="checkbox" className={cn("mt-0.5 h-4 w-4 accent-[#c99428]", FOCUS)} checked={placeholders} onChange={(e) => setPlaceholders(e.target.checked)} />
          <span>Turn DJ name, date, time, venue and address into placeholders (filled from each booking)</span>
        </label>
      )}
      <input
        ref={ref}
        id={id}
        type="file"
        accept=".svg,image/svg+xml"
        className="sr-only"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          if (!f) return;
          setErr(null);
          setBusy(true);
          try {
            await onImport(f, placeholders);
          } catch (x) {
            setErr(x instanceof Error ? x.message : "Import failed.");
          } finally {
            setBusy(false);
            if (ref.current) ref.current.value = "";
          }
        }}
      />
      <label htmlFor={id} className={cn(iconBtn, "mt-2 h-10 w-full cursor-pointer justify-center", busy && "pointer-events-none opacity-50")}>
        <Upload size={15} /> {busy ? "Importing…" : "Choose SVG file"}
      </label>
      {err && (
        <p role="alert" className="mt-2 text-xs text-status-declined">
          {err}
        </p>
      )}
    </div>
  );
}

/** Soft edges: pick which sides fade and by how much, or an oval vignette. */
function FeatherSection({ n, canStyle, set }: { n: ImageNode; canStyle: boolean; set: (p: Partial<ImageNode>, k?: string) => void }) {
  const f = n.feather ?? { amount: 0, shape: "edges" as const };
  const max = Math.round(Math.max(n.width, n.height));
  const sides = f.sides ?? { top: f.amount, right: f.amount, bottom: f.amount, left: f.amount };
  const on = featherOn(f);
  const dflt = Math.round(Math.min(n.width, n.height) / 4);
  const put = (patch: Partial<typeof f>) => set({ feather: { ...f, ...patch } }, "feather");
  const setSides = (s: Partial<typeof sides>) => put({ shape: "edges", sides: { ...sides, ...s } });
  const preset = (s: [number, number, number, number]) => {
    const a = Math.max(...Object.values(sides), f.amount, 0) || dflt;
    setSides({ top: s[0] * a, right: s[1] * a, bottom: s[2] * a, left: s[3] * a });
  };
  const presets: [string, [number, number, number, number]][] = [
    ["All sides", [1, 1, 1, 1]],
    ["Top only", [1, 0, 0, 0]],
    ["Bottom only", [0, 0, 1, 0]],
    ["Top & bottom", [1, 0, 1, 0]],
    ["Left & right", [0, 1, 0, 1]],
    ["Left only", [0, 0, 0, 1]],
    ["Right only", [0, 1, 0, 0]]
  ];
  const isPreset = (p: [number, number, number, number]) => f.shape === "edges" && on && [sides.top, sides.right, sides.bottom, sides.left].every((v, i) => (p[i] ? v > 0 : v === 0));
  return (
    <Section title="Soft edges (feather)" defaultOpen={on}>
      <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Feather style">
        <button className={cn(iconBtn, !on && "border-gold bg-gold-soft")} aria-pressed={!on} disabled={!canStyle} onClick={() => put({ amount: 0, sides: { top: 0, right: 0, bottom: 0, left: 0 } })}>
          Off
        </button>
        <button className={cn(iconBtn, on && f.shape === "edges" && "border-gold bg-gold-soft")} aria-pressed={on && f.shape === "edges"} disabled={!canStyle} onClick={() => (on && f.shape === "edges" ? undefined : preset([1, 1, 1, 1]))}>
          Edges
        </button>
        <button className={cn(iconBtn, on && f.shape === "oval" && "border-gold bg-gold-soft")} aria-pressed={on && f.shape === "oval"} disabled={!canStyle} onClick={() => put({ shape: "oval", amount: f.amount || dflt })}>
          Oval
        </button>
      </div>

      {f.shape === "edges" && (
        <>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Which sides fade">
            {presets.map(([label, p]) => (
              <button key={label} className={cn(iconBtn, "h-8 px-2", isPreset(p) && "border-gold bg-gold-soft")} aria-pressed={isPreset(p)} disabled={!canStyle} onClick={() => preset(p)}>
                {label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-2">
            {(["top", "bottom", "left", "right"] as const).map((k) => (
              <Slider key={k} label={k[0].toUpperCase() + k.slice(1)} value={Math.round(sides[k])} min={0} max={max} step={1} display={`${Math.round(sides[k])} px`} disabled={!canStyle} onChange={(v) => setSides({ [k]: v })} />
            ))}
          </div>
        </>
      )}
      {f.shape === "oval" && on && <Slider label="Fade width" value={f.amount} min={1} max={Math.round(Math.min(n.width, n.height) / 2)} step={1} display={`${Math.round(f.amount)} px`} disabled={!canStyle} onChange={(v) => put({ amount: v })} />}
      {on && (
        <div className="grid grid-cols-2 gap-1.5" role="group" aria-label="Fade curve">
          {(
            [
              ["smooth", "Smooth fade"],
              ["linear", "Even fade"]
            ] as const
          ).map(([c, l]) => (
            <button key={c} className={cn(iconBtn, (f.curve ?? "smooth") === c && "border-gold bg-gold-soft")} aria-pressed={(f.curve ?? "smooth") === c} disabled={!canStyle} onClick={() => put({ curve: c })}>
              {l}
            </button>
          ))}
        </div>
      )}
      <p className="text-[11px] text-muted">Fade just the top or bottom of a photo into the background, or any mix of sides. Works best without a frame border.</p>
    </Section>
  );
}
