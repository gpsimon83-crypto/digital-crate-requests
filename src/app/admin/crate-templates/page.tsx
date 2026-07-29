"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Plus, X, LayoutTemplate } from "lucide-react";
import { TagPicker } from "@/components/dashboard/tag-picker";
import { EVENT_TYPES, GENRE_TAGS, ERA_OPTIONS, CLEAN_MUSIC_OPTIONS } from "@/lib/crate-taxonomy";

interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  event_type: string | null;
  target_genres: string[];
  target_eras: string[];
  clean_requirement: string | null;
  active: boolean;
}

export default function AdminCrateTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("");
  const [targetGenres, setTargetGenres] = useState<string[]>([]);
  const [targetEras, setTargetEras] = useState<string[]>([]);
  const [cleanRequirement, setCleanRequirement] = useState("");
  const [adding, setAdding] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/crate-templates");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load templates");
      setTemplates(data.templates ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/crate-templates");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load templates");
        if (!cancelled) setTemplates(data.templates ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleAdd() {
    if (!name.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/crate-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          eventType: eventType || undefined,
          targetGenres,
          targetEras,
          cleanRequirement: cleanRequirement || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add template");
      setName("");
      setDescription("");
      setEventType("");
      setTargetGenres([]);
      setTargetEras([]);
      setCleanRequirement("");
      setShowCreate(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this template? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/crate-templates/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove template");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <>
      <PageHeader
        title="Crate Templates"
        subtitle="Recommended genre/era/energy balance for common event types — never actual songs."
        action={
          <Button variant="primary" onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? <X size={15} /> : <Plus size={15} />}
            {showCreate ? "Cancel" : "New Template"}
          </Button>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        {showCreate && (
        <div className="flex flex-col gap-3 border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Template Name</span>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Wedding Reception"
                className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Event Type</span>
              <select
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
              >
                <option value="">None</option>
                {EVENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Description</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description"
              className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Clean Music Requirement</span>
            <select
              value={cleanRequirement}
              onChange={(e) => setCleanRequirement(e.target.value)}
              className="w-full rounded-[2px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            >
              <option value="">None</option>
              {CLEAN_MUSIC_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </label>
          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wide text-muted">Target Genres</p>
            <TagPicker options={GENRE_TAGS} selected={targetGenres} onChange={setTargetGenres} />
          </div>
          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wide text-muted">Target Eras</p>
            <TagPicker options={ERA_OPTIONS} selected={targetEras} onChange={setTargetEras} />
          </div>
          {error && <p className="text-xs text-status-declined">{error}</p>}
          <Button variant="primary" onClick={handleAdd} disabled={adding} className="self-start">
            {adding ? "Adding…" : "Add Template"}
          </Button>
        </div>
        )}

        {templates === null && <p className="text-sm text-muted">Loading...</p>}
        {templates?.length === 0 && <EmptyState icon={LayoutTemplate} title="No templates yet" body="Create your first crate template." />}
        {templates && templates.length > 0 && (
          <div className="flex flex-col divide-y divide-border border-y border-border">
            {templates.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-3 px-1 py-3 transition-colors hover:bg-gold/[0.04]">
                <div className="min-w-0">
                  <p className="font-semibold">{t.name}</p>
                  <p className="text-xs text-muted">
                    {t.event_type ?? "Any event"}
                    {t.clean_requirement ? ` · ${t.clean_requirement}` : ""}
                    {t.target_genres.length > 0 ? ` · ${t.target_genres.join(", ")}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(t.id)}
                  className="shrink-0 rounded-[2px] border border-status-declined/40 px-3 py-1.5 text-xs text-status-declined"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
