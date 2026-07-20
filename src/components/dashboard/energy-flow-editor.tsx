"use client";

import { useState } from "react";
import { GripVertical, Wand2, Check, Undo2, Save } from "lucide-react";
import type { CrateRow } from "@/lib/browser-serato";
import { buildCrateBytes } from "@/lib/browser-serato";
import type { ResolvedTrack } from "@/lib/crate-track-resolver";
import { ENERGY_FLOW_SECTIONS } from "@/lib/crate-taxonomy";
import { errorMessage } from "@/lib/error-message";
import { NewBadge } from "@/components/dashboard/new-badge";

type Sections = Record<string, string[]>; // section -> ordered track keys

function emptySections(): Sections {
  const s: Sections = {};
  for (const sec of ENERGY_FLOW_SECTIONS) s[sec] = [];
  return s;
}

/** Buckets a track into one of the 10 Energy Flow sections purely from its
 * heuristic energy score — used both as the fallback for unassigned tracks
 * and as the basis for "Suggest Energy Order". */
function guessSection(score: number): string {
  if (score < 20) return "Arrival / Background";
  if (score < 35) return "Warm-Up";
  if (score < 50) return "Groove";
  if (score < 65) return "Build";
  if (score < 78) return "Peak";
  if (score < 85) return "Reset";
  if (score < 90) return "Rebuild";
  if (score < 95) return "Final Peak";
  if (score < 98) return "Closing";
  return "Last Dance";
}

function buildSuggested(tracks: ResolvedTrack[]): Sections {
  const s = emptySections();
  const sorted = [...tracks].sort((a, b) => a.energyScore - b.energyScore);
  for (const t of sorted) s[guessSection(t.energyScore)].push(t.key);
  return s;
}

export function EnergyFlowEditor({
  crate,
  rootHandle,
  tracks,
  savedSections,
  onSectionsSaved,
  onCrateRebuilt,
}: {
  crate: CrateRow;
  rootHandle: FileSystemDirectoryHandle;
  tracks: ResolvedTrack[] | null;
  savedSections: { key: string; section: string }[];
  onSectionsSaved: (sections: { key: string; section: string }[]) => void;
  onCrateRebuilt: () => void;
}) {
  const [sections, setSections] = useState<Sections | null>(null);
  // Which crate `sections` was built for — building the initial section
  // assignment is a pure synchronous computation, so per React's own
  // guidance we adjust state during render instead of in an effect (see
  // react-hooks/set-state-in-effect / "you might not need an effect").
  const [builtForName, setBuiltForName] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<Sections | null>(null);
  const [previous, setPrevious] = useState<Sections | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (tracks && builtForName !== crate.name) {
    let initial: Sections;
    if (savedSections.length > 0) {
      const s = emptySections();
      const known = new Set(tracks.map((t) => t.key));
      for (const { key, section } of savedSections) {
        if (known.has(key) && s[section]) s[section].push(key);
      }
      // Any track not in the saved assignment (added since last save) gets bucketed by heuristic.
      const assigned = new Set(savedSections.map((s2) => s2.key));
      for (const t of tracks) {
        if (!assigned.has(t.key)) s[guessSection(t.energyScore)].push(t.key);
      }
      initial = s;
    } else {
      initial = buildSuggested(tracks);
    }
    setSections(initial);
    setBuiltForName(crate.name);
  }

  const byKey = new Map((tracks ?? []).map((t) => [t.key, t]));

  function moveTrack(key: string, toSection: string, beforeKey: string | null) {
    setSections((cur) => {
      if (!cur) return cur;
      const next: Sections = {};
      for (const sec of ENERGY_FLOW_SECTIONS) next[sec] = cur[sec].filter((k) => k !== key);
      const insertAt = beforeKey ? next[toSection].indexOf(beforeKey) : -1;
      if (insertAt === -1) next[toSection].push(key);
      else next[toSection].splice(insertAt, 0, key);
      return next;
    });
  }

  function suggestOrder() {
    if (!tracks) return;
    setSuggested(buildSuggested(tracks));
  }

  function applySuggested() {
    if (!suggested) return;
    setPrevious(sections);
    setSections(suggested);
    setSuggested(null);
  }

  function undo() {
    if (!previous) return;
    setSections(previous);
    setPrevious(null);
  }

  async function saveOrderToCrate() {
    if (!sections) return;
    const flatKeys = ENERGY_FLOW_SECTIONS.flatMap((sec) => sections[sec]);
    const paths = flatKeys.map((k) => byKey.get(k)?.path).filter((p): p is string => !!p);
    if (paths.length === 0) return;
    if (!confirm(`This will rewrite "${crate.name.replace(/\.crate$/, "")}" on disk with the new track order. Continue?`)) return;

    setSaving(true);
    setError(null);
    try {
      const seratoHandle = await rootHandle.getDirectoryHandle("_Serato_");
      const subcrates = await seratoHandle.getDirectoryHandle("Subcrates", { create: true });
      const dest = await subcrates.getFileHandle(crate.name, { create: true });
      const writable = await dest.createWritable();
      await writable.write(new Blob([new Uint8Array(buildCrateBytes(paths))]));
      await writable.close();

      const sectionAssignment = ENERGY_FLOW_SECTIONS.flatMap((sec) => sections[sec].map((key) => ({ key, section: sec })));
      onSectionsSaved(sectionAssignment);
      onCrateRebuilt();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  if (!sections) {
    return <p className="text-xs text-muted">Analyzing…</p>;
  }

  const showCompare = suggested !== null;
  const columns: { title: string; data: Sections; readOnly: boolean }[] = showCompare
    ? [{ title: "Current Order", data: sections, readOnly: true }, { title: "Suggested Order", data: suggested!, readOnly: true }]
    : [{ title: "Drag tracks between sections", data: sections, readOnly: false }];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Energy Flow <NewBadge />
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {!showCompare && (
            <button onClick={suggestOrder} className="flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium text-muted hover:border-gold/40 hover:text-gold">
              <Wand2 size={13} /> Suggest Energy Order
            </button>
          )}
          {showCompare && (
            <>
              <button onClick={applySuggested} className="flex items-center gap-1.5 rounded-full bg-gold px-3 py-1.5 text-xs font-bold text-black">
                <Check size={13} /> Apply Suggested Order
              </button>
              <button onClick={() => setSuggested(null)} className="rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium text-muted hover:border-white/25 hover:text-foreground">
                Keep Manual Order
              </button>
            </>
          )}
          {previous && !showCompare && (
            <button onClick={undo} className="flex items-center gap-1.5 rounded-full border border-white/12 px-3 py-1.5 text-xs font-medium text-muted hover:border-status-declined/60 hover:text-status-declined">
              <Undo2 size={13} /> Undo
            </button>
          )}
          {!showCompare && (
            <button
              onClick={saveOrderToCrate}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-full border border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-40"
            >
              <Save size={13} /> {saving ? "Saving…" : "Save Order to Crate"}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-status-declined">{error}</p>}

      <div className={`grid gap-3 ${showCompare ? "sm:grid-cols-2" : ""}`}>
        {columns.map((col) => (
          <div key={col.title} className="flex flex-col gap-2">
            {showCompare && <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{col.title}</p>}
            <div className="flex max-h-[28rem] flex-col gap-2 overflow-y-auto pr-1">
              {ENERGY_FLOW_SECTIONS.map((sec) => (
                <div
                  key={sec}
                  onDragOver={(e) => !col.readOnly && e.preventDefault()}
                  onDrop={(e) => {
                    if (col.readOnly) return;
                    e.preventDefault();
                    const key = e.dataTransfer.getData("text/plain");
                    if (key) moveTrack(key, sec, null);
                    setDragKey(null);
                  }}
                  className="rounded-lg border border-white/8 bg-panel/30 p-2"
                >
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted">
                    {sec} <span className="normal-case text-muted/60">({col.data[sec].length})</span>
                  </p>
                  <div className="flex flex-col gap-1">
                    {col.data[sec].map((key) => {
                      const t = byKey.get(key);
                      if (!t) return null;
                      return (
                        <div
                          key={key}
                          draggable={!col.readOnly}
                          onDragStart={(e) => {
                            setDragKey(key);
                            e.dataTransfer.setData("text/plain", key);
                          }}
                          onDragOver={(e) => !col.readOnly && e.preventDefault()}
                          onDrop={(e) => {
                            if (col.readOnly) return;
                            e.preventDefault();
                            const droppedKey = e.dataTransfer.getData("text/plain");
                            if (droppedKey && droppedKey !== key) moveTrack(droppedKey, sec, key);
                            setDragKey(null);
                          }}
                          className={`flex items-center gap-1.5 rounded-md border border-white/8 bg-panel/60 px-2 py-1 text-xs ${
                            !col.readOnly ? "cursor-grab active:cursor-grabbing" : ""
                          } ${dragKey === key ? "opacity-40" : ""}`}
                        >
                          {!col.readOnly && <GripVertical size={12} className="shrink-0 text-muted" />}
                          <span className="truncate">{t.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
