"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createPortal } from "react-dom";
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Copy,
  Download,
  GripVertical,
  Image as ImageIcon,
  Monitor,
  Plus,
  Redo2,
  Save,
  Send,
  Smartphone,
  Trash2,
  Undo2,
  Upload,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  AUDIENCES,
  AUDIENCE_LABELS,
  placeholdersIn,
  BLOCK_LABELS,
  MERGE_FIELDS,
  SAMPLE_MERGE_VALUES,
  defaultBlock,
  isKnownToken,
  newBlockId,
  sanitizeDesign,
  tokensUsed,
  type EmailBlock,
  type EmailBlockType,
  type EmailDesign,
  type MergeValues
} from "@/lib/comm/blocks";
import { renderEmailHtml } from "@/lib/comm/render";

const ADDABLE: EmailBlockType[] = ["heading", "text", "image", "button", "divider", "spacer", "social", "logo", "footer"];

const inputCls = "w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none";
const labelCls = "mb-1 block text-[11px] uppercase tracking-wide text-muted";

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong.");
  return data as T;
}

type Patch = Partial<Record<string, string | number>>;

function nowMs() {
  return Date.now();
}

export function EmailStudio({ designId }: { designId: string }) {
  const [design, setDesign] = useState<EmailDesign | null>(null);
  const [past, setPast] = useState<EmailDesign[]>([]);
  const [future, setFuture] = useState<EmailDesign[]>([]);
  const lastPush = useRef(0);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [mobilePane, setMobilePane] = useState<"edit" | "preview">("edit");
  const [dragId, setDragId] = useState<string | null>(null);
  const [modal, setModal] = useState<"test" | "send" | null>(null);
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  useEffect(() => {
    api<{ design: EmailDesign }>(`/api/admin/communications/designs/${designId}`)
      .then((d) => setDesign(sanitizeDesign(d.design)))
      .catch((e) => setError(e.message));
  }, [designId]);

  /** Every edit goes through here so undo/redo always works. Rapid typing is grouped into one undo step. */
  const update = (fn: (d: EmailDesign) => EmailDesign) => {
    if (!design) return;
    const now = nowMs();
    if (now - lastPush.current > 800) setPast((p) => [...p.slice(-60), design]);
    lastPush.current = now;
    setFuture([]);
    setDesign(fn(design));
    setDirty(true);
  };

  const undo = () => {
    if (!past.length || !design) return;
    setFuture((f) => [design, ...f]);
    setDesign(past[past.length - 1]);
    setPast(past.slice(0, -1));
    setDirty(true);
    lastPush.current = 0;
  };

  const redo = () => {
    if (!future.length || !design) return;
    setPast((p) => [...p, design]);
    setDesign(future[0]);
    setFuture(future.slice(1));
    setDirty(true);
    lastPush.current = 0;
  };

  const save = useCallback(async () => {
    if (!design) return false;
    setSaving(true);
    setError(null);
    try {
      await api(`/api/admin/communications/designs/${designId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(design)
      });
      setDirty(false);
      setSavedAt(new Date());
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save.");
      return false;
    } finally {
      setSaving(false);
    }
  }, [design, designId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      if (e.key === "s") {
        e.preventDefault();
        save();
      } else if (e.key === "z" && !e.shiftKey && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        undo();
      } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        e.preventDefault();
        redo();
      }
    }
    function onUnload(e: BeforeUnloadEvent) {
      if (dirty) e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [save, undo, redo, dirty]);

  const previewHtml = useMemo(() => (design && origin ? renderEmailHtml(design, SAMPLE_MERGE_VALUES, { baseUrl: origin }) : ""), [design, origin]);

  const issues = useMemo(() => {
    if (!design) return [];
    const out: string[] = [];
    if (!design.subject.trim()) out.push("Add a subject line.");
    for (const t of tokensUsed(design)) if (!isKnownToken(t)) out.push(`{{${t}}} isn't a known field and will be blank.`);
    for (const b of design.blocks) {
      if (b.type === "button" && !b.url.trim()) out.push(`Button “${b.label}” has no link, so it won't appear.`);
      if (b.type === "image" && !b.url.trim()) out.push("An image block has no picture yet, so it won't appear.");
      if (b.type === "image" && b.url && !b.alt.trim()) out.push("Add a short description (alt text) to each image.");
    }
    return out;
  }, [design]);

  function setBlock(id: string, patch: Patch) {
    update((d) => ({ ...d, blocks: d.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as EmailBlock) : b)) }));
  }
  function moveBlock(id: string, dir: -1 | 1) {
    update((d) => {
      const i = d.blocks.findIndex((b) => b.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.blocks.length) return d;
      const blocks = [...d.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...d, blocks };
    });
  }
  function dropOn(targetId: string) {
    if (!dragId || dragId === targetId) return;
    update((d) => {
      const blocks = [...d.blocks];
      const from = blocks.findIndex((b) => b.id === dragId);
      const [moved] = blocks.splice(from, 1);
      const to = blocks.findIndex((b) => b.id === targetId);
      blocks.splice(to, 0, moved);
      return { ...d, blocks };
    });
    setDragId(null);
  }

  function exportHtml() {
    if (!design) return;
    const keepTokens: MergeValues = Object.fromEntries(MERGE_FIELDS.map((f) => [f.token, `{{${f.token}}}`]));
    const html = renderEmailHtml(design, keepTokens, { baseUrl: origin });
    const blob = new Blob([html], { type: "text/html" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${design.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase() || "email"}.html`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  if (error && !design) {
    return (
      <div className="p-8">
        <p className="text-sm text-status-declined">{error}</p>
        <Link href="/admin/communications?tab=templates" className="mt-3 inline-block text-sm text-gold underline">
          Back to templates
        </Link>
      </div>
    );
  }
  if (!design) return <p className="p-8 text-sm text-muted">Loading the Studio…</p>;

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Toolbar */}
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-2 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
        <Link href="/admin/communications?tab=templates" className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-muted hover:bg-black/5 hover:text-foreground" aria-label="Back to templates">
          <ArrowLeft size={18} />
        </Link>
        <input
          value={design.name}
          onChange={(e) => update((d) => ({ ...d, name: e.target.value }))}
          aria-label="Template name"
          className="min-w-0 flex-1 rounded-[10px] border border-transparent bg-transparent px-2 py-1.5 font-display text-xl font-light hover:border-border focus:border-gold focus:outline-none sm:max-w-sm"
        />
        <span className="hidden text-xs text-muted sm:inline">{saving ? "Saving…" : dirty ? "Unsaved changes" : savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Saved"}</span>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button variant="icon" onClick={undo} disabled={!past.length} title="Undo (⌘Z)" aria-label="Undo">
            <Undo2 size={16} />
          </Button>
          <Button variant="icon" onClick={redo} disabled={!future.length} title="Redo (⇧⌘Z)" aria-label="Redo">
            <Redo2 size={16} />
          </Button>
          <Button variant="icon" onClick={exportHtml} title="Export HTML" aria-label="Export HTML">
            <Download size={16} />
          </Button>
          <Button onClick={save} disabled={saving || !dirty}>
            <Save size={15} /> Save
          </Button>
          <Button data-tour="studio-test" onClick={async () => (dirty ? (await save()) && setModal("test") : setModal("test"))}>Send test</Button>
          <Button variant="primary" data-tour="studio-send" onClick={async () => (dirty ? (await save()) && setModal("send") : setModal("send"))}>
            <Send size={15} /> Send
          </Button>
        </div>
        {error && <p className="w-full text-sm text-status-declined">{error}</p>}
      </header>

      <div className="flex gap-1 border-b border-border px-4 py-2 lg:hidden">
        {(["edit", "preview"] as const).map((p) => (
          <button key={p} onClick={() => setMobilePane(p)} className={cn("rounded-[10px] px-3 py-1.5 text-sm", mobilePane === p ? "bg-gold-soft font-medium" : "text-muted")}>
            {p === "edit" ? "Edit" : "Preview"}
          </button>
        ))}
      </div>

      <div className="grid flex-1 lg:grid-cols-[minmax(360px,460px)_1fr]">
        {/* Editor */}
        <aside className={cn("space-y-5 border-r border-border p-4 sm:p-6", mobilePane === "preview" && "hidden lg:block")}>
          <div className="space-y-3">
            <label className="block">
              <span className={labelCls}>Subject line</span>
              <input value={design.subject} onChange={(e) => update((d) => ({ ...d, subject: e.target.value }))} className={inputCls} placeholder="e.g. You're all set for {{event_date}}" />
            </label>
            <label className="block">
              <span className={labelCls}>Preview text (shows after the subject in the inbox)</span>
              <input value={design.preheader} onChange={(e) => update((d) => ({ ...d, preheader: e.target.value }))} className={inputCls} />
            </label>
            <div data-tour="studio-audience">
              <span className={labelCls}>Who it&apos;s for</span>
              <div className="grid grid-cols-2 gap-2">
                {AUDIENCES.map((a) => (
                  <button
                    key={a}
                    onClick={() => update((d) => ({ ...d, audience: a }))}
                    className={cn(
                      "rounded-[10px] border px-3 py-2 text-sm",
                      design.audience === a ? "border-gold bg-gold-soft font-medium" : "border-black/10 hover:border-gold"
                    )}
                  >
                    {AUDIENCE_LABELS[a]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className={labelCls}>Style</span>
              <div className="flex gap-2">
                {(["dark", "light"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => update((d) => ({ ...d, theme: t }))}
                    className={cn(
                      "flex-1 rounded-[10px] border px-3 py-2 text-sm",
                      design.theme === t ? "border-gold bg-gold-soft font-medium" : "border-black/10 hover:border-gold"
                    )}
                  >
                    {t === "dark" ? "Black & gold" : "Light & cream"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {issues.length > 0 && (
            <ul className="space-y-1 rounded-[10px] border border-status-pending/40 bg-status-pending/10 px-3 py-2 text-xs">
              {issues.map((i) => (
                <li key={i}>• {i}</li>
              ))}
            </ul>
          )}

          <div className="space-y-2" data-tour="studio-blocks">
            {design.blocks.map((b, idx) => (
              <div
                key={b.id}
                onDragOver={(e) => dragId && e.preventDefault()}
                onDrop={() => dropOn(b.id)}
                className={cn("rounded-[12px] border bg-card", dragId === b.id ? "border-gold opacity-60" : "border-border")}
              >
                <div className="flex items-center gap-1 border-b border-border px-2 py-1.5">
                  <span draggable onDragStart={() => setDragId(b.id)} onDragEnd={() => setDragId(null)} className="cursor-grab p-1 text-muted" title="Drag to reorder" aria-hidden>
                    <GripVertical size={15} />
                  </span>
                  <span className="text-xs font-medium uppercase tracking-wide">{BLOCK_LABELS[b.type]}</span>
                  <div className="ml-auto flex items-center">
                    <Button size="sm" variant="icon" onClick={() => moveBlock(b.id, -1)} disabled={idx === 0} aria-label="Move up">
                      <ArrowUp size={14} />
                    </Button>
                    <Button size="sm" variant="icon" onClick={() => moveBlock(b.id, 1)} disabled={idx === design.blocks.length - 1} aria-label="Move down">
                      <ArrowDown size={14} />
                    </Button>
                    <Button
                      size="sm"
                      variant="icon"
                      aria-label="Duplicate block"
                      onClick={() => update((d) => ({ ...d, blocks: [...d.blocks.slice(0, idx + 1), { ...b, id: newBlockId() }, ...d.blocks.slice(idx + 1)] }))}
                    >
                      <Copy size={14} />
                    </Button>
                    <Button size="sm" variant="icon" aria-label="Delete block" onClick={() => update((d) => ({ ...d, blocks: d.blocks.filter((x) => x.id !== b.id) }))}>
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </div>
                <div className="space-y-2.5 p-3">
                  <BlockFields block={b} onChange={(p) => setBlock(b.id, p)} onError={setError} />
                </div>
              </div>
            ))}
          </div>

          <AddBlockMenu onAdd={(t) => update((d) => ({ ...d, blocks: [...d.blocks, defaultBlock(t)] }))} />

          <details className="rounded-[10px] border border-border bg-card px-3 py-2 text-xs text-muted">
            <summary className="cursor-pointer font-medium text-foreground">Personalization fields</summary>
            <p className="mt-2">Type these anywhere (subject, text, button links). Each client gets their own details.</p>
            <ul className="mt-2 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {MERGE_FIELDS.map((f) => (
                <li key={f.token}>
                  <code className="rounded bg-panel px-1">{`{{${f.token}}}`}</code> {f.label}
                </li>
              ))}
            </ul>
            <p className="mt-2">Formatting in text: **bold**, [link text](https://…), a line starting with “- ” becomes a bullet.</p>
          </details>
        </aside>

        {/* Preview */}
        <section className={cn("bg-panel/60 p-4 sm:p-6", mobilePane === "edit" && "hidden lg:block")}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs text-muted">Preview with sample data</p>
            <div className="flex rounded-[10px] border border-border bg-card p-0.5">
              <button onClick={() => setDevice("desktop")} className={cn("rounded-[8px] px-2.5 py-1", device === "desktop" && "bg-gold-soft")} aria-label="Desktop preview">
                <Monitor size={15} />
              </button>
              <button onClick={() => setDevice("mobile")} className={cn("rounded-[8px] px-2.5 py-1", device === "mobile" && "bg-gold-soft")} aria-label="Mobile preview">
                <Smartphone size={15} />
              </button>
            </div>
          </div>
          <div className="rounded-[12px] border border-border bg-card px-4 py-2 text-sm">
            <p className="truncate">
              <span className="text-muted">Subject: </span>
              {design.subject.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (_m, t: string) => SAMPLE_MERGE_VALUES[t] ?? "") || <em className="text-muted">No subject</em>}
            </p>
          </div>
          <div className="mt-3 flex justify-center">
            <iframe
              title="Email preview"
              srcDoc={previewHtml}
              sandbox="allow-popups"
              className="h-[75vh] rounded-[12px] border border-border bg-white transition-[width]"
              style={{ width: device === "mobile" ? 390 : "100%", maxWidth: 760 }}
            />
          </div>
        </section>
      </div>

      {modal === "test" && <TestModal designId={designId} design={design} onClose={() => setModal(null)} />}
      {modal === "send" && <SendModal designId={designId} design={design} onClose={() => setModal(null)} />}
    </div>
  );
}

function AddBlockMenu({ onAdd }: { onAdd: (t: EmailBlockType) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <Button onClick={() => setOpen((o) => !o)} className="w-full">
        <Plus size={15} /> Add a block
      </Button>
      {open && (
        <div className="mt-2 grid grid-cols-3 gap-2">
          {ADDABLE.map((t) => (
            <button
              key={t}
              onClick={() => {
                onAdd(t);
                setOpen(false);
              }}
              className="rounded-[10px] border border-border bg-card px-2 py-2 text-xs hover:border-gold"
            >
              {BLOCK_LABELS[t]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AlignPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex gap-1">
      {(["left", "center"] as const).map((a) => (
        <button key={a} onClick={() => onChange(a)} className={cn("rounded-[8px] border px-2.5 py-1 text-xs", value === a ? "border-gold bg-gold-soft" : "border-black/10")}>
          {a === "left" ? "Left" : "Center"}
        </button>
      ))}
    </div>
  );
}

function BlockFields({ block: b, onChange, onError }: { block: EmailBlock; onChange: (p: Patch) => void; onError: (m: string | null) => void }) {
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setUploading(true);
    onError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { url } = await api<{ url: string }>("/api/admin/communications/upload", { method: "POST", body: fd });
      onChange({ url });
    } catch (e) {
      onError(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  switch (b.type) {
    case "logo":
      return <p className="text-xs text-muted">The Digital Crate DJs logo, in gold on dark emails and black on light ones.</p>;
    case "heading":
      return (
        <>
          <input value={b.text} onChange={(e) => onChange({ text: e.target.value })} className={inputCls} aria-label="Heading text" />
          <div className="flex items-center gap-3">
            <AlignPicker value={b.align} onChange={(v) => onChange({ align: v })} />
            <select value={b.size} onChange={(e) => onChange({ size: e.target.value })} className="rounded-[8px] border border-black/10 bg-panel px-2 py-1 text-xs" aria-label="Heading size">
              <option value="lg">Large</option>
              <option value="md">Medium</option>
            </select>
          </div>
        </>
      );
    case "text":
    case "footer":
      return (
        <>
          <textarea value={b.text} onChange={(e) => onChange({ text: e.target.value })} rows={b.type === "text" ? 6 : 3} className={inputCls} aria-label="Text" />
          <div className="flex flex-wrap items-center gap-2">
            {b.type === "text" && <AlignPicker value={b.align} onChange={(v) => onChange({ align: v })} />}
            <select
              value=""
              onChange={(e) => e.target.value && onChange({ text: `${b.text}{{${e.target.value}}}` })}
              className="rounded-[8px] border border-black/10 bg-panel px-2 py-1 text-xs"
              aria-label="Insert personalization field"
            >
              <option value="">Insert field…</option>
              {MERGE_FIELDS.map((f) => (
                <option key={f.token} value={f.token}>
                  {f.label}
                </option>
              ))}
            </select>
          </div>
        </>
      );
    case "image":
      return (
        <>
          {b.url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={b.url} alt="" className="max-h-32 w-full rounded-[8px] border border-border object-cover" />
          ) : (
            <div className="flex h-20 items-center justify-center rounded-[8px] border border-dashed border-border text-muted">
              <ImageIcon size={18} />
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              <Upload size={13} /> {uploading ? "Uploading…" : "Upload image"}
            </Button>
            {b.url && (
              <Button size="sm" variant="text" onClick={() => onChange({ url: "" })}>
                Remove
              </Button>
            )}
          </div>
          <label className="block">
            <span className={labelCls}>Or image web address</span>
            <input value={b.url} onChange={(e) => onChange({ url: e.target.value })} className={inputCls} placeholder="https://…" />
          </label>
          <label className="block">
            <span className={labelCls}>Description (alt text)</span>
            <input value={b.alt} onChange={(e) => onChange({ alt: e.target.value })} className={inputCls} placeholder="e.g. Couple's first dance at The Edgewater" />
          </label>
          <label className="block">
            <span className={labelCls}>Link when clicked (optional)</span>
            <input value={b.link} onChange={(e) => onChange({ link: e.target.value })} className={inputCls} placeholder="https://… or {{portal_link}}" />
          </label>
          <select value={b.width} onChange={(e) => onChange({ width: e.target.value })} className="rounded-[8px] border border-black/10 bg-panel px-2 py-1 text-xs" aria-label="Image width">
            <option value="full">Full width</option>
            <option value="medium">Medium</option>
            <option value="small">Small</option>
          </select>
        </>
      );
    case "button":
      return (
        <>
          <label className="block">
            <span className={labelCls}>Button text</span>
            <input value={b.label} onChange={(e) => onChange({ label: e.target.value })} className={inputCls} />
          </label>
          <label className="block">
            <span className={labelCls}>Link</span>
            <input value={b.url} onChange={(e) => onChange({ url: e.target.value })} className={inputCls} placeholder="https://…" />
          </label>
          <div className="flex flex-wrap gap-1.5">
            {[
              ["Client portal", "{{portal_link}}"],
              ["Review link", "{{review_link}}"],
              ["Website", "https://digitalcratedjs.com"]
            ].map(([label, url]) => (
              <button key={url} onClick={() => onChange({ url })} className="rounded-full border border-black/10 px-2.5 py-1 text-[11px] hover:border-gold">
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <AlignPicker value={b.align} onChange={(v) => onChange({ align: v })} />
            <select value={b.style} onChange={(e) => onChange({ style: e.target.value })} className="rounded-[8px] border border-black/10 bg-panel px-2 py-1 text-xs" aria-label="Button style">
              <option value="solid">Solid gold</option>
              <option value="outline">Outline</option>
            </select>
          </div>
        </>
      );
    case "divider":
      return <p className="text-xs text-muted">A thin line to separate sections.</p>;
    case "spacer":
      return (
        <label className="flex items-center gap-3 text-xs">
          Height
          <input type="range" min={8} max={80} step={4} value={b.height} onChange={(e) => onChange({ height: Number(e.target.value) })} className="flex-1 accent-[var(--gold)]" />
          <span className="w-10 text-right tabular-nums">{b.height}px</span>
        </label>
      );
    case "social":
      return (
        <>
          {(["instagram", "facebook", "tiktok", "youtube", "website"] as const).map((k) => (
            <label key={k} className="block">
              <span className={labelCls}>{k === "tiktok" ? "TikTok" : k === "youtube" ? "YouTube" : k[0].toUpperCase() + k.slice(1)}</span>
              <input value={b[k]} onChange={(e) => onChange({ [k]: e.target.value })} className={inputCls} placeholder="https://…" />
            </label>
          ))}
        </>
      );
  }
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative flex max-h-[90dvh] w-full max-w-lg flex-col rounded-t-[16px] bg-card shadow-xl sm:rounded-[16px]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-display text-xl font-light">{title}</h2>
          <Button variant="icon" onClick={onClose} aria-label="Close">
            <X size={16} />
          </Button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  );
}

function TestModal({ designId, design, onClose }: { designId: string; design: EmailDesign; onClose: () => void }) {
  const [to, setTo] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  async function send() {
    setState("sending");
    setMsg(null);
    try {
      const r = await api<{ to: string; result: { sent: number; errors: string[] } }>("/api/admin/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ designId, design, test: true, testEmail: to })
      });
      setState("done");
      setMsg(r.result.sent ? `Test sent to ${r.to}. It uses sample data and starts with [TEST].` : r.result.errors[0] || "The test couldn't be sent.");
    } catch (e) {
      setState("idle");
      setMsg(e instanceof Error ? e.message : "Something went wrong.");
    }
  }
  return (
    <Modal title="Send a test" onClose={onClose}>
      <p className="text-sm text-muted">Sends one copy with sample data, so you can check it in your own inbox and on your phone.</p>
      <label className="mt-3 block">
        <span className={labelCls}>Send to (leave empty for your own login email)</span>
        <input value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} placeholder="you@example.com" type="email" />
      </label>
      {msg && <p className={cn("mt-3 text-sm", state === "done" ? "text-status-approved" : "text-status-declined")}>{msg}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={onClose}>Close</Button>
        <Button variant="primary" onClick={send} disabled={state === "sending"}>
          {state === "sending" ? "Sending…" : "Send test"}
        </Button>
      </div>
    </Modal>
  );
}

interface RecipientOption {
  id: string;
  name: string;
  email: string;
  nextEvent: { starts_at: string; event_type: string | null } | null;
}

function SendModal({ designId, design, onClose }: { designId: string; design: EmailDesign; onClose: () => void }) {
  const audience = design.audience;
  const isDj = audience === "dj";
  const isVenue = audience === "venue";
  const isPersonal = audience === "personal";
  const who = isDj ? "DJs" : isVenue ? "venue managers" : isPersonal ? "people" : "clients";
  const leftover = placeholdersIn(design);
  const [q, setQ] = useState("");
  const [upcomingOnly, setUpcomingOnly] = useState(false);
  const [options, setOptions] = useState<RecipientOption[] | null>(null);
  const [picked, setPicked] = useState<Map<string, RecipientOption>>(new Map());
  const [extra, setExtra] = useState("");
  const [step, setStep] = useState<"pick" | "check" | "done">("pick");
  const [check, setCheck] = useState<{ recipientCount: number; warnings: { email: string; name: string | null; missing: string[] }[] } | null>(null);
  const [result, setResult] = useState<{ sent: number; suppressed: number; failed: number; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (isPersonal) return;
    const t = setTimeout(() => {
      api<{ recipients: RecipientOption[] }>(
        `/api/admin/communications/recipients?q=${encodeURIComponent(q)}${isDj ? "&type=dj" : isVenue ? "&type=venue" : upcomingOnly ? "&upcoming=1" : ""}`
      )
        .then((d) => setOptions(d.recipients))
        .catch((e) => setErr(e.message));
    }, 250);
    return () => clearTimeout(t);
  }, [q, upcomingOnly, isDj, isVenue, isPersonal]);

  const extraEmails = extra
    .split(/[\s,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  function toggle(o: RecipientOption) {
    setPicked((m) => {
      const n = new Map(m);
      if (n.has(o.id)) n.delete(o.id);
      else n.set(o.id, o);
      return n;
    });
  }

  async function run(confirm: boolean) {
    setBusy(true);
    setErr(null);
    try {
      const idKey = isDj ? "djIds" : isVenue ? "managerIds" : "clientIds";
      const body = JSON.stringify({ designId, design, ...(isPersonal ? {} : { [idKey]: [...picked.keys()] }), emails: extraEmails, confirm });
      const r = await api<{ check?: typeof check; result?: typeof result }>("/api/admin/communications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body
      });
      if (r.check) {
        setCheck(r.check);
        setStep("check");
      }
      if (r.result) {
        setResult(r.result);
        setStep("done");
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  const fieldLabel = (t: string) => MERGE_FIELDS.find((f) => f.token === t)?.label ?? t;

  return (
    <Modal title={step === "done" ? "Sent" :  `Send to ${who}`} onClose={onClose}>
      {step === "pick" && (
        <>
          <p className="text-sm text-muted">
            {isPersonal
              ? "Personal emails go only to the addresses you type. They aren't linked to any client, DJ or venue record. Each person gets their own copy and nobody sees anyone else's address."
              : `Each person gets their own copy, personalized from their ${isDj ? "DJ profile and next assigned gig" : isVenue ? "venue (name, portal link, DCDJs contact)" : "client record"}. Nobody sees anyone else's address.`}
          </p>
          {!isPersonal && <>
          <div className="mt-3 flex items-center gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} className={inputCls} placeholder={`Search ${who} by name or email`} aria-label={`Search ${who}`} />
          </div>
          {!isDj && <label className="mt-2 flex items-center gap-2 text-xs">
            <input type="checkbox" checked={upcomingOnly} onChange={(e) => setUpcomingOnly(e.target.checked)} className="accent-[var(--gold)]" />
            Only clients with an upcoming event
          </label>}
          <div className="mt-2 max-h-64 overflow-y-auto rounded-[10px] border border-border">
            {!options ? (
              <p className="p-3 text-sm text-muted">Loading {who}…</p>
            ) : !options.length ? (
              <p className="p-3 text-sm text-muted">
                {isDj
                  ? "No DJs with an email address match. A DJ needs a CRM login or signature email to show here; you can also type addresses below."
                  : isVenue
                    ? "No venue managers match. Add managers in Admin → Venues → Manage."
                    : "No clients with an email address match."}
              </p>
            ) : (
              <>
                <button
                  onClick={() =>
                    setPicked((m) => {
                      const n = new Map(m);
                      const all = options.every((o) => n.has(o.id));
                      for (const o of options) {
                        if (all) n.delete(o.id);
                        else n.set(o.id, o);
                      }
                      return n;
                    })
                  }
                  className="w-full border-b border-border px-3 py-2 text-left text-xs text-gold hover:bg-black/[0.02]"
                >
                  {options.every((o) => picked.has(o.id)) ? "Clear these" : `Select all ${options.length} shown`}
                </button>
                {options.map((o) => (
                  <label key={o.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-black/[0.02]">
                    <input type="checkbox" checked={picked.has(o.id)} onChange={() => toggle(o)} className="accent-[var(--gold)]" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm">{o.name}</span>
                      <span className="block truncate text-xs text-muted">
                        {o.email}
                        {o.nextEvent && ` · ${o.nextEvent.event_type ?? "Event"} ${new Date(o.nextEvent.starts_at).toLocaleDateString()}`}
                      </span>
                    </span>
                  </label>
                ))}
              </>
            )}
          </div>
          </>}
          <label className="mt-3 block">
            <span className={labelCls}>{isPersonal ? "Email addresses (separated by commas)" : "Other email addresses (optional, separated by commas)"}</span>
            <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={isPersonal ? 4 : 2} className={inputCls} placeholder="name@example.com, other@example.com" />
            {!isPersonal && <span className="mt-1 block text-[11px] text-muted">These aren&apos;t CRM {who}, so only the company name can be filled in for them.</span>}
          </label>
          {err && <p className="mt-3 text-sm text-status-declined">{err}</p>}
          <div className="mt-4 flex items-center justify-between gap-2">
            <span className="text-sm text-muted">{picked.size + extraEmails.length} selected</span>
            <Button variant="primary" onClick={() => run(false)} disabled={busy || picked.size + extraEmails.length === 0}>
              {busy ? "Checking…" : "Review & send"}
            </Button>
          </div>
        </>
      )}

      {step === "check" && check && (
        <>
          <p className="text-sm">
            Ready to send <strong>{design.subject || "this email"}</strong> to <strong>{check.recipientCount}</strong> {check.recipientCount === 1 ? "person" : "people"}.
          </p>
          {leftover.length > 0 && (
            <div className="mt-3 rounded-[10px] border border-status-declined/40 bg-status-declined/10 p-3 text-sm">
              <p className="font-medium">This email still has fill-ins to replace:</p>
              <p className="mt-1 text-xs">{leftover.join(", ")}</p>
              <p className="mt-1 text-xs text-muted">Go back, edit the text, then send. Everyone would see these exactly as written.</p>
            </div>
          )}
          {check.warnings.length > 0 ? (
            <div className="mt-3 rounded-[10px] border border-status-pending/40 bg-status-pending/10 p-3 text-sm">
              <p className="font-medium">Some details are missing and will be blank:</p>
              <ul className="mt-1 max-h-40 space-y-0.5 overflow-y-auto text-xs">
                {check.warnings.map((w) => (
                  <li key={w.email}>
                    {w.name || w.email}: {w.missing.map(fieldLabel).join(", ")}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-status-approved">Everyone has the details this email uses.</p>
          )}
          {err && <p className="mt-3 text-sm text-status-declined">{err}</p>}
          <div className="mt-4 flex justify-end gap-2">
            <Button onClick={() => setStep("pick")} disabled={busy}>
              Back
            </Button>
            <Button variant="primary" onClick={() => run(true)} disabled={busy}>
              <Send size={15} /> {busy ? "Sending…" : `Send to ${check.recipientCount}`}
            </Button>
          </div>
        </>
      )}

      {step === "done" && result && (
        <>
          <p className="text-sm">
            <strong>{result.sent}</strong> sent
            {result.suppressed > 0 && <>, {result.suppressed} skipped (do-not-email list)</>}
            {result.failed > 0 && <>, {result.failed} failed</>}.
          </p>
          {result.errors.length > 0 && <p className="mt-2 text-sm text-status-declined">{result.errors[0]}</p>}
          <p className="mt-2 text-sm text-muted">Delivery status for each person appears in Communications → Sent.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Link href="/admin/communications?tab=sent" className="inline-flex h-9 items-center rounded-[10px] border border-black/15 px-4 text-sm hover:border-gold">
              View sent log
            </Link>
            <Button variant="primary" onClick={onClose}>
              Done
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
