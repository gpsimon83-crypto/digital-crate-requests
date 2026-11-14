"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, CalendarClock, Plus, Trash2, X } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ScenePreviewClient } from "@/components/flyers/client";
import { cn } from "@/lib/utils";
import { fillText } from "@/lib/flyers/scene";
import { FORMATS, FORMAT_KEYS, type FormatKey, type PlaceholderValues, type Scene, type TemplateContent } from "@/lib/flyers/types";

type Template = { id: string; name: string; description: string | null; venue_id: string | null; venue_name: string | null; version: number; content: TemplateContent };
type Design = { id: string; dj_id: string; title: string; format: FormatKey; scene: Scene; updated_at: string; djs?: { display_name: string } | null };
type Booking = { id: string; title: string | null; starts_at: string | null; venue_id: string | null; venue_name: string | null; values: PlaceholderValues };
type Boot = {
  me: { staff: boolean; dj: { id: string; display_name: string; has_photo: boolean } | null };
  templates: Template[];
  designs: Design[];
  events: Booking[];
  djs: { id: string; display_name: string; has_photo: boolean }[];
};

export default function FlyersPage() {
  return (
    <Suspense fallback={null}>
      <Flyers />
    </Suspense>
  );
}

const SAMPLE: PlaceholderValues = { dj_name: "DJ Name", event_title: "Saturday Night", event_date: "Saturday, November 22", start_time: "9 PM", end_time: "2 AM", venue_name: "Venue Name", venue_address: "123 Main St, Milwaukee, WI" };

function previewScene(scene: Scene, values: PlaceholderValues): Scene {
  return { ...scene, nodes: scene.nodes.map((n) => (n.kind === "text" ? { ...n, text: fillText(n.text, values) } : n)) };
}

function Flyers() {
  const router = useRouter();
  const params = useSearchParams();
  const [data, setData] = useState<Boot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [startOpen, setStartOpen] = useState(!!params.get("event"));

  async function load() {
    const r = await fetch("/api/flyers");
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error ?? "Couldn't load the Flyer Creator.");
    setData(j);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function remove(d: Design) {
    if (!window.confirm(`Delete “${d.title}”? This can't be undone.`)) return;
    const r = await fetch(`/api/flyers/designs/${d.id}`, { method: "DELETE" });
    if (r.ok) setData((x) => (x ? { ...x, designs: x.designs.filter((y) => y.id !== d.id) } : x));
  }

  return (
    <div className="min-h-dvh bg-background">
      <PageHeader
        title="Flyer Creator"
        subtitle={data?.me.staff && !data.me.dj ? "Make or open a DJ's flyers." : "Pick a template, your photo and name fill in, then make it yours."}
        action={
          <div className="flex items-center gap-2">
            <Link href="/dj-dashboard" className="hidden items-center gap-1.5 rounded-[10px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted hover:text-foreground sm:flex">
              <ArrowLeft size={14} /> Dashboard
            </Link>
            <Button variant="primary" onClick={() => setStartOpen(true)} disabled={!data}>
              <Plus size={15} /> New flyer
            </Button>
          </div>
        }
      />
      <main className="mx-auto max-w-6xl px-6 py-8 sm:px-8">
        {error && <p className="rounded-[10px] border border-status-declined/30 bg-status-declined/10 p-4 text-sm text-status-declined">{error}</p>}
        {!data && !error && <p className="text-sm text-muted">Loading…</p>}
        {data && (
          <>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">{data.me.dj ? "My flyers" : "Flyers"}</h2>
            {data.designs.length ? (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {data.designs.map((d) => (
                  <li key={d.id} className="group relative">
                    <Link href={`/dj-dashboard/flyers/${d.id}`} className="block rounded-[12px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                      <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[12px] border border-black/10 bg-[#1a1610] p-2">
                        <ScenePreviewClient scene={d.scene} width={d.format === "story" ? 120 : 200} />
                      </div>
                      <p className="mt-2 truncate text-sm font-medium">{d.title}</p>
                      <p className="text-xs text-muted">
                        {FORMATS[d.format].label} · {new Date(d.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        {!data.me.dj && d.djs?.display_name ? ` · ${d.djs.display_name}` : ""}
                      </p>
                    </Link>
                    <button className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-white/90 text-muted opacity-0 shadow transition-opacity hover:text-status-declined focus-visible:opacity-100 group-hover:opacity-100" aria-label={`Delete ${d.title}`} onClick={() => void remove(d)}>
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="rounded-[14px] border border-dashed border-black/15 p-10 text-center">
                <p className="text-sm text-muted">No flyers yet.</p>
                <Button variant="primary" className="mt-3" onClick={() => setStartOpen(true)}>
                  <Plus size={15} /> Make your first flyer
                </Button>
              </div>
            )}
          </>
        )}
      </main>
      {startOpen && data && <StartDialog data={data} initialEvent={params.get("event")} onClose={() => setStartOpen(false)} onCreated={(id) => router.push(`/dj-dashboard/flyers/${id}`)} />}
    </div>
  );
}

function StartDialog({ data, initialEvent, onClose, onCreated }: { data: Boot; initialEvent: string | null; onClose: () => void; onCreated: (id: string) => void }) {
  const staffOnly = !data.me.dj;
  const [djId, setDjId] = useState(data.me.dj?.id ?? "");
  const [eventId, setEventId] = useState(initialEvent && data.events.some((e) => e.id === initialEvent) ? initialEvent : "");
  const event = data.events.find((e) => e.id === eventId) ?? null;
  // Templates for the booking's venue first.
  const templates = useMemo(() => [...data.templates].sort((a, b) => Number(b.venue_id === event?.venue_id && !!b.venue_id) - Number(a.venue_id === event?.venue_id && !!a.venue_id)), [data.templates, event]);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const template = templates.find((t) => t.id === templateId) ?? null;
  const formats = FORMAT_KEYS.filter((k) => template?.content.formats[k]);
  const [format, setFormat] = useState<FormatKey>("portrait");
  const fmt = formats.includes(format) ? format : (formats[0] ?? "portrait");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const djName = staffOnly ? data.djs.find((d) => d.id === djId)?.display_name ?? "DJ Name" : data.me.dj!.display_name;
  const values = { ...SAMPLE, dj_name: djName, ...Object.fromEntries(Object.entries(event?.values ?? {}).filter(([, v]) => v)) };
  const previewDj = staffOnly ? djId || null : data.me.dj?.id ?? null;

  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);

  async function create() {
    setErr(null);
    setBusy(true);
    const r = await fetch("/api/flyers/designs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ templateId, format: fmt, eventId: eventId || null, djId: djId || null }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(j.error ?? "Couldn't start the flyer.");
    onCreated(j.id);
  }

  const field = "w-full rounded-[10px] border border-black/12 bg-white px-3 py-2 text-sm focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50";
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="start-title" onClick={onClose}>
      <div className="flex max-h-[94dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[18px] bg-[var(--card)] shadow-2xl sm:rounded-[18px]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-black/10 px-5 py-4">
          <h2 id="start-title" className="text-lg font-semibold">
            New flyer
          </h2>
          <button autoFocus className="grid h-10 w-10 place-items-center rounded-full text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" aria-label="Close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 gap-5 overflow-y-auto p-5 md:grid-cols-[1fr_260px]">
          <div className="flex flex-col gap-4">
            {staffOnly && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">For which DJ</span>
                <select className={field} value={djId} onChange={(e) => setDjId(e.target.value)}>
                  <option value="">Choose a DJ…</option>
                  {data.djs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.display_name}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!staffOnly && (
              <label className="block">
                <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Booking (optional)</span>
                <select className={field} value={eventId} onChange={(e) => setEventId(e.target.value)}>
                  <option value="">No booking: I&apos;ll type the details</option>
                  {data.events.map((e) => (
                    <option key={e.id} value={e.id}>
                      {[e.starts_at ? new Date(e.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : null, e.title, e.venue_name].filter(Boolean).join(" · ")}
                    </option>
                  ))}
                </select>
                <span className="mt-1 flex items-center gap-1 text-[11px] text-muted">
                  <CalendarClock size={11} /> The booking&apos;s date, time and venue fill in. Editing the flyer never changes the booking.
                </span>
              </label>
            )}
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Template</legend>
              {templates.length ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {templates.map((t) => {
                    const sc = t.content.formats[fmt] ?? t.content.formats[FORMAT_KEYS.find((k) => t.content.formats[k])!]!;
                    return (
                      <label key={t.id} className={cn("cursor-pointer rounded-[12px] border-2 p-2 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold", templateId === t.id ? "border-gold bg-gold-soft/50" : "border-transparent hover:border-black/15")}>
                        <input type="radio" name="template" className="sr-only" checked={templateId === t.id} onChange={() => setTemplateId(t.id)} />
                        <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[8px] bg-[#1a1610]">
                          <ScenePreviewClient scene={previewScene(sc, values)} width={sc.format === "story" ? 90 : 140} ctx={{ previewDjId: previewDj }} />
                        </div>
                        <p className="mt-1.5 truncate text-sm font-medium">{t.name}</p>
                        {t.venue_name && <p className="truncate text-[11px] text-muted">For {t.venue_name}</p>}
                      </label>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted">No templates are published yet.</p>
              )}
            </fieldset>
          </div>
          <div className="flex flex-col gap-4">
            <fieldset>
              <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Size</legend>
              <div className="flex flex-col gap-2">
                {FORMAT_KEYS.map((k) => (
                  <label key={k} className={cn("flex min-h-11 cursor-pointer items-center justify-between rounded-[10px] border px-3 text-sm has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-gold", fmt === k ? "border-gold bg-gold-soft/50" : "border-black/12", !formats.includes(k) && "cursor-not-allowed opacity-40")}>
                    <span>
                      <input type="radio" name="format" className="sr-only" checked={fmt === k} disabled={!formats.includes(k)} onChange={() => setFormat(k)} />
                      {FORMATS[k].label}
                    </span>
                    <span className="text-xs text-muted">{FORMATS[k].size}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            {template && (
              <div className="flex justify-center rounded-[12px] bg-[#1a1610] p-3">
                <ScenePreviewClient scene={previewScene(template.content.formats[fmt]!, values)} width={fmt === "story" ? 130 : 220} ctx={{ previewDjId: previewDj }} />
              </div>
            )}
            {err && (
              <p role="alert" className="text-sm text-status-declined">
                {err}
              </p>
            )}
            <Button variant="cta" onClick={() => void create()} disabled={busy || !template || (staffOnly && !djId)}>
              {busy ? "Starting…" : "Start editing"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
