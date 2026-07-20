"use client";

import { useMemo, useState } from "react";
import { Search, Play, Pause, Plus, X, Save, Tag } from "lucide-react";
import { buildCrateBytes, type AudioFileEntry } from "@/lib/browser-serato";
import { errorMessage } from "@/lib/error-message";
import { useMasterPlayer } from "@/components/dashboard/master-player";
import { resolveArtistTitle, normalizeTrackKey } from "@/lib/energy-heuristic";
import { TrackTagEditor } from "@/components/dashboard/track-tag-editor";
import { NewBadge } from "@/components/dashboard/new-badge";

function trackLabel(f: AudioFileEntry): string {
  const dot = f.name.lastIndexOf(".");
  return dot === -1 ? f.name : f.name.slice(0, dot);
}

function trackKey(f: AudioFileEntry): string {
  return f.path.join("/");
}

/**
 * Manual, track-by-track crate builder: search the scanned library,
 * preview individual tracks (real audio playback via an object URL on
 * the actual file, not a mock), stage/unstage tracks one at a time, then
 * save as a new Serato crate. This is the selective alternative to
 * "Build Crates from Folders", which just auto-groups by folder.
 */
export function ManualCrateBuilder({
  files,
  rootHandle,
  seratoFound,
  onCrateSaved,
}: {
  files: AudioFileEntry[];
  rootHandle: FileSystemDirectoryHandle | null;
  seratoFound: boolean;
  onCrateSaved?: (info: { name: string; songKeys: { key: string; artist: string; title: string }[] }) => void;
}) {
  const [query, setQuery] = useState("");
  const [staged, setStaged] = useState<AudioFileEntry[]>([]);
  const [crateName, setCrateName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ created: boolean; reason?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [taggingFile, setTaggingFile] = useState<AudioFileEntry | null>(null);
  const player = useMasterPlayer();

  const stagedKeys = useMemo(() => new Set(staged.map(trackKey)), [staged]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const matches: AudioFileEntry[] = [];
    for (const f of files) {
      if (stagedKeys.has(trackKey(f))) continue;
      if (trackLabel(f).toLowerCase().includes(q) || f.top.toLowerCase().includes(q)) {
        matches.push(f);
        if (matches.length >= 60) break;
      }
    }
    return matches;
  }, [query, files, stagedKeys]);

  async function togglePreview(f: AudioFileEntry) {
    try {
      const file = await f.handle.getFile();
      await player.play(trackKey(f), trackLabel(f), file);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  function addTrack(f: AudioFileEntry) {
    setStaged((s) => [...s, f]);
    setSaveResult(null);
  }

  function removeTrack(f: AudioFileEntry) {
    setStaged((s) => s.filter((t) => trackKey(t) !== trackKey(f)));
    setSaveResult(null);
  }

  async function saveCrate() {
    if (!rootHandle || !crateName.trim() || staged.length === 0) return;
    setSaving(true);
    setError(null);
    setSaveResult(null);
    try {
      const seratoHandle = await rootHandle.getDirectoryHandle("_Serato_");
      const subcrates = await seratoHandle.getDirectoryHandle("Subcrates", { create: true });
      const safeName = crateName.trim().replace(/[\\/:*?"<>|]/g, "_");
      const fileName = `${safeName}.crate`;

      try {
        await subcrates.getFileHandle(fileName);
        setSaveResult({ created: false, reason: "A crate with this name already exists." });
        return;
      } catch {
        // doesn't exist yet — good
      }

      // Serato's real crate paths are relative to the volume root with no
      // drive-name segment (e.g. "MUSIC/QUE DROP/Song.mp3") — verified
      // against an actual Serato-written crate.
      const paths = staged.map((f) => ["MUSIC", ...f.path].join("/"));
      const dest = await subcrates.getFileHandle(fileName, { create: true });
      const writable = await dest.createWritable();
      await writable.write(new Blob([new Uint8Array(buildCrateBytes(paths))]));
      await writable.close();

      setSaveResult({ created: true });
      const songKeys = staged.map((f) => {
        const { artist, title } = resolveArtistTitle(null, null, f.name);
        return { key: normalizeTrackKey(artist, title), artist, title };
      });
      onCrateSaved?.({ name: safeName, songKeys });
      setStaged([]);
      setCrateName("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-xs text-status-declined">{error}</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 text-xs font-medium text-muted">
            <Search size={13} /> Search your library
            <span className="normal-case text-muted/70">— tag songs as you go</span>
            <NewBadge />
          </label>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type at least 2 characters — artist, title, or folder"
            className="rounded-xl border border-white/10 bg-panel px-4 py-2 text-sm focus:border-gold focus:outline-none"
          />
          <div className="max-h-72 overflow-y-auto rounded-xl border border-white/8 bg-panel/30">
            {query.trim().length < 2 ? (
              <p className="p-3 text-xs text-muted">Start typing to search.</p>
            ) : results.length === 0 ? (
              <p className="p-3 text-xs text-muted">No matches.</p>
            ) : (
              results.map((f) => {
                const key = trackKey(f);
                const isPlaying = player.isPlaying(key);
                return (
                  <div key={key} className="flex items-center gap-2 border-b border-white/5 px-3 py-2 last:border-0 hover:bg-white/5">
                    <button
                      onClick={() => togglePreview(f)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/12 text-muted hover:border-gold/40 hover:text-gold"
                      title="Preview"
                    >
                      {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{trackLabel(f)}</p>
                      <p className="truncate text-xs text-muted">{f.top}</p>
                    </div>
                    <button
                      onClick={() => setTaggingFile(f)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/12 text-muted hover:border-gold/40 hover:text-gold"
                      title="Tag Song"
                    >
                      <Tag size={12} />
                    </button>
                    <button
                      onClick={() => addTrack(f)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-gold/40 text-gold hover:bg-gold/10"
                      title="Add to crate"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-medium text-muted">
            Crate in progress <span className="text-muted/70">({staged.length} tracks)</span>
          </label>
          <div className="max-h-72 min-h-[3rem] overflow-y-auto rounded-xl border border-white/8 bg-panel/30">
            {staged.length === 0 ? (
              <p className="p-3 text-xs text-muted">Add tracks from the search results.</p>
            ) : (
              staged.map((f) => {
                const key = trackKey(f);
                const isPlaying = player.isPlaying(key);
                return (
                  <div key={key} className="flex items-center gap-2 border-b border-white/5 px-3 py-2 last:border-0 hover:bg-white/5">
                    <button
                      onClick={() => togglePreview(f)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/12 text-muted hover:border-gold/40 hover:text-gold"
                      title="Preview"
                    >
                      {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm">{trackLabel(f)}</p>
                      <p className="truncate text-xs text-muted">{f.top}</p>
                    </div>
                    <button
                      onClick={() => removeTrack(f)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-full border border-white/12 text-muted hover:border-status-declined/60 hover:text-status-declined"
                      title="Remove from crate"
                    >
                      <X size={13} />
                    </button>
                  </div>
                );
              })
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              value={crateName}
              onChange={(e) => setCrateName(e.target.value)}
              placeholder="Crate name"
              className="min-w-0 flex-1 rounded-xl border border-white/10 bg-panel px-4 py-2 text-sm focus:border-gold focus:outline-none"
            />
            <button
              onClick={saveCrate}
              disabled={saving || !crateName.trim() || staged.length === 0 || !seratoFound}
              className="flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs font-bold text-black disabled:opacity-40"
            >
              <Save size={13} /> {saving ? "Saving…" : "Save Crate"}
            </button>
          </div>
          {saveResult && (
            <p className="text-xs text-muted">
              {saveResult.created ? "Crate saved." : saveResult.reason}
            </p>
          )}
        </div>
      </div>

      {taggingFile && (() => {
        const { artist, title } = resolveArtistTitle(null, null, taggingFile.name);
        return (
          <TrackTagEditor
            trackKey={normalizeTrackKey(artist, title)}
            label={trackLabel(taggingFile)}
            onClose={() => setTaggingFile(null)}
          />
        );
      })()}
    </div>
  );
}
