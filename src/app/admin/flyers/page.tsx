"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, ExternalLink, Pencil, Plus, RotateCcw, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ScenePreviewClient } from "@/components/flyers/client";
import { cn } from "@/lib/utils";
import { fillText } from "@/lib/flyers/scene";
import { FORMATS, FORMAT_KEYS, type FormatKey, type Scene, type TemplateContent } from "@/lib/flyers/types";

type Row = { id: string; slug: string | null; name: string; description: string | null; venue_id: string | null; status: "draft" | "published" | "archived"; draft: TemplateContent; formats: FormatKey[]; versions: number; current_version: number | null; published_at: string | null; designs: number; updated_at: string };

const SAMPLE = { dj_name: "DJ Name", event_title: "Saturday Night", event_date: "Saturday, November 22", start_time: "9 PM", end_time: "2 AM", venue_name: "Venue Name", venue_address: "123 Main St, Milwaukee, WI" };
const preview = (s: Scene): Scene => ({ ...s, nodes: s.nodes.map((n) => (n.kind === "text" ? { ...n, text: fillText(n.text, SAMPLE) } : n)) });

export default function AdminFlyersPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [venues, setVenues] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [sizes, setSizes] = useState<FormatKey[]>(["square", "portrait", "story"]);
  const [venueId, setVenueId] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/admin/flyers/templates");
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error ?? "Couldn't load templates.");
    setRows(j.templates);
    setVenues(j.venues);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, []);

  async function create() {
    setBusy(true);
    setError(null);
    const r = await fetch("/api/admin/flyers/templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, formats: sizes, venueId: venueId || null, copyFrom: copyFrom || undefined }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setError(j.error ?? "Couldn't create the template.");
    router.push(`/admin/flyers/templates/${j.id}`);
  }

  async function setStatus(t: Row, status: "archived" | "published") {
    const r = await fetch(`/api/admin/flyers/templates/${t.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error ?? "Couldn't update.");
    void load();
  }

  async function remove(t: Row) {
    if (!window.confirm(t.designs ? `${t.designs} flyer(s) use “${t.name}”, so it will be archived (hidden from DJs) instead of deleted.` : `Delete “${t.name}”? This can't be undone.`)) return;
    const r = await fetch(`/api/admin/flyers/templates/${t.id}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return setError(j.error ?? "Couldn't delete.");
    void load();
  }

  const field = "w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50";
  return (
    <div>
      <PageHeader
        title="Flyer Templates"
        subtitle="Build layered flyer templates. DJs pick one, their photo and name fill in, and they edit every piece."
        action={
          <Link href="/dj-dashboard/flyers" className="flex items-center gap-1.5 rounded-[10px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted hover:text-foreground">
            All DJ flyers <ExternalLink size={13} />
          </Link>
        }
      />
      <div className="mx-auto grid max-w-6xl gap-8 px-6 py-8 sm:px-8 lg:grid-cols-[1fr_320px]">
        <section>
          {error && <p className="mb-4 rounded-[10px] border border-status-declined/30 bg-status-declined/10 p-3 text-sm text-status-declined">{error}</p>}
          {!rows && !error && <p className="text-sm text-muted">Loading…</p>}
          {rows && (
            <ul className="grid gap-4 sm:grid-cols-2">
              {rows.map((t) => {
                const first = FORMAT_KEYS.find((k) => t.draft.formats[k]);
                const sc = first ? t.draft.formats[first] : null;
                return (
                  <li key={t.id} className="flex gap-4 rounded-[14px] border border-black/10 bg-card p-3">
                    <div className="flex h-[150px] w-[120px] shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#1a1610]">{sc && <ScenePreviewClient scene={preview(sc)} width={sc.format === "story" ? 84 : 116} />}</div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <p className="truncate font-semibold">{t.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        <span className={cn("mr-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", t.status === "published" ? "bg-status-approved/15 text-status-approved" : t.status === "archived" ? "bg-black/5 text-muted" : "bg-status-pending/15 text-status-pending")}>{t.status}</span>
                        {t.current_version ? `v${t.current_version}` : "not published"} · {t.designs} flyer{t.designs === 1 ? "" : "s"}
                      </p>
                      <p className="mt-1 text-xs text-muted">{t.formats.map((f) => FORMATS[f].label).join(" · ") || "No sizes"}</p>
                      {t.venue_id && <p className="text-xs text-muted">For {venues.find((v) => v.id === t.venue_id)?.name ?? "a venue"}</p>}
                      <div className="mt-auto flex flex-wrap gap-1.5 pt-2">
                        <Link href={`/admin/flyers/templates/${t.id}`} className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-black/12 px-2.5 text-xs hover:border-gold">
                          <Pencil size={13} /> Edit
                        </Link>
                        {t.status === "archived" ? (
                          <button className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-black/12 px-2.5 text-xs hover:border-gold disabled:opacity-40" disabled={!t.current_version} onClick={() => void setStatus(t, "published")}>
                            <RotateCcw size={13} /> Restore
                          </button>
                        ) : (
                          t.status === "published" && (
                            <button className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-black/12 px-2.5 text-xs hover:border-gold" onClick={() => void setStatus(t, "archived")}>
                              <Archive size={13} /> Archive
                            </button>
                          )
                        )}
                        <button className="inline-flex h-8 items-center gap-1 rounded-[8px] border border-status-declined/30 px-2.5 text-xs text-status-declined" onClick={() => void remove(t)} aria-label={`Delete ${t.name}`}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
        <aside className="flex flex-col gap-4">
          <div className="rounded-[14px] border border-black/10 bg-card p-4">
            <p className="mb-3 font-semibold">New template</p>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Name</span>
              <input className={field} value={name} maxLength={80} onChange={(e) => setName(e.target.value)} placeholder="e.g. Friday Night Live" />
            </label>
            <label className="mb-3 block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Start from</span>
              <select className={field} value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)}>
                <option value="">Blank sizes</option>
                {(rows ?? []).map((t) => (
                  <option key={t.id} value={t.id}>
                    Copy of {t.name}
                  </option>
                ))}
              </select>
            </label>
            {!copyFrom && (
              <fieldset className="mb-3">
                <legend className="mb-1 text-xs uppercase tracking-wide text-muted">Sizes</legend>
                {FORMAT_KEYS.map((k) => (
                  <label key={k} className="flex min-h-8 items-center gap-2 text-sm">
                    <input type="checkbox" className="accent-[#c99428]" checked={sizes.includes(k)} onChange={(e) => setSizes((s) => (e.target.checked ? [...s, k] : s.filter((x) => x !== k)))} />
                    {FORMATS[k].label} <span className="text-xs text-muted">{FORMATS[k].size}</span>
                  </label>
                ))}
              </fieldset>
            )}
            <label className="mb-4 block">
              <span className="mb-1 block text-xs uppercase tracking-wide text-muted">Venue (optional)</span>
              <select className={field} value={venueId} onChange={(e) => setVenueId(e.target.value)}>
                <option value="">Any venue</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </label>
            <Button variant="primary" className="w-full" disabled={busy || !name.trim() || (!copyFrom && !sizes.length)} onClick={() => void create()}>
              <Plus size={15} /> Create and open editor
            </Button>
          </div>
          <div className="rounded-[14px] border border-black/10 bg-card p-4 text-sm">
            <p className="mb-2 font-semibold">Using art made in ChatGPT</p>
            <ol className="list-decimal space-y-1.5 pl-4 text-xs leading-relaxed text-muted">
              <li>Ask for the background with no words on it, at the size you need (1080 × 1080, 1080 × 1350 or 1080 × 1920). Ask for overlays (glows, sparkles, frames) as separate PNGs with transparent backgrounds.</li>
              <li>In the template editor, open Assets, choose “Background (no text)” or “Decorative overlay”, and upload each file.</li>
              <li>Click an asset to place it, then add text from the Text tab. Use placeholders like {"{{dj_name}}"} and {"{{event_date}}"}.</li>
              <li>Set what DJs may change per layer under Template settings, then Publish.</li>
            </ol>
          </div>
        </aside>
      </div>
    </div>
  );
}
