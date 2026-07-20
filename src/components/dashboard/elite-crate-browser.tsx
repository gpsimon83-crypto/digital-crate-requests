"use client";

import { useEffect, useState } from "react";
import { Star, Download } from "lucide-react";
import type { EnrichedTrack } from "@/lib/smart-crates";
import { buildCrateBytes } from "@/lib/browser-serato";
import { errorMessage } from "@/lib/error-message";

interface SharedElitePack {
  id: string;
  dj_id: string;
  name: string;
  category: string | null;
  elite_category: string | null;
  song_keys: { key: string; artist: string; title: string }[];
  djs: { display_name: string } | { display_name: string }[] | null;
}

function ownerName(djs: SharedElitePack["djs"]): string {
  if (!djs) return "Unknown DJ";
  return Array.isArray(djs) ? djs[0]?.display_name ?? "Unknown DJ" : djs.display_name;
}

/**
 * Elite Packs from other DJs — metadata only (song list, never audio).
 * "Copy to My Library" matches each song key against what's actually on
 * THIS DJ's own scanned drive and builds a real local .crate with only
 * the matches — no file is ever transferred between DJs.
 */
export function EliteCrateBrowser({
  enrichedTracks,
  rootHandle,
}: {
  enrichedTracks: EnrichedTrack[] | null;
  rootHandle: FileSystemDirectoryHandle | null;
}) {
  const [packs, setPacks] = useState<SharedElitePack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copyResult, setCopyResult] = useState<Record<string, { copied: number; missing: number }>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dj/library/crate-profiles?scope=shared-elite")
      .then((r) => r.json())
      .then((d) => setPacks(d.profiles ?? []))
      .catch((err) => setError(errorMessage(err)));
  }, []);

  async function copyPack(pack: SharedElitePack) {
    if (!rootHandle || !enrichedTracks) return;
    setBusyId(pack.id);
    setError(null);
    try {
      const byKey = new Map(enrichedTracks.map((t) => [t.key, t]));
      const matched = pack.song_keys.map((s) => byKey.get(s.key)).filter((t): t is EnrichedTrack => !!t);
      const missing = pack.song_keys.length - matched.length;

      if (matched.length === 0) {
        setCopyResult((r) => ({ ...r, [pack.id]: { copied: 0, missing: pack.song_keys.length } }));
        return;
      }

      const seratoHandle = await rootHandle.getDirectoryHandle("_Serato_");
      const subcrates = await seratoHandle.getDirectoryHandle("Subcrates", { create: true });
      const safeName = `${pack.name} (Elite Pack)`.replace(/[\\/:*?"<>|]/g, "_");
      const fileName = `${safeName}.crate`;
      const paths = matched.map((t) => ["MUSIC", ...t.path].join("/"));
      const dest = await subcrates.getFileHandle(fileName, { create: true });
      const writable = await dest.createWritable();
      await writable.write(new Blob([new Uint8Array(buildCrateBytes(paths))]));
      await writable.close();

      setCopyResult((r) => ({ ...r, [pack.id]: { copied: matched.length, missing } }));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  if (packs === null) return null;
  if (packs.length === 0) {
    return <p className="text-xs text-muted">No shared Elite Packs from other DJs yet.</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      {error && <p className="text-xs text-status-declined">{error}</p>}
      {packs.map((pack) => {
        const result = copyResult[pack.id];
        return (
          <div key={pack.id} className="flex items-center justify-between gap-3 rounded-xl border border-gold/20 bg-gold/5 p-3">
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                <Star size={13} className="shrink-0 text-gold" /> {pack.name}
              </p>
              <p className="text-xs text-muted">
                {pack.elite_category ?? pack.category ?? "Elite Crate"} · {pack.song_keys.length} songs · by {ownerName(pack.djs)}
              </p>
              {result && (
                <p className="mt-1 text-[11px] text-muted">
                  Copied {result.copied} song(s){result.missing > 0 && `, ${result.missing} not found on your drive`}.
                </p>
              )}
            </div>
            <button
              onClick={() => copyPack(pack)}
              disabled={busyId !== null || !rootHandle || !enrichedTracks}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-40"
            >
              <Download size={13} /> {busyId === pack.id ? "Copying…" : "Copy to My Library"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
