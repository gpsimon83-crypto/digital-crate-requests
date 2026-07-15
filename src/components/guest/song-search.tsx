"use client";

import { useEffect, useState } from "react";
import { Search, Music2, RefreshCw } from "lucide-react";

export interface SelectedTrack {
  title: string;
  artist: string;
  albumArt?: string | null;
  explicit?: boolean;
}

interface SpotifyResult {
  id: string;
  title: string;
  artist: string;
  albumArt: string | null;
  explicit: boolean;
}

export function SongSearch({
  onSelect,
}: {
  onSelect: (track: SelectedTrack) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SpotifyResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<SelectedTrack | null>(null);

  useEffect(() => {
    if (selected || query.trim().length < 2) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.tracks ?? []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query, selected]);

  if (selected) {
    return (
      <div className="relative flex items-center gap-4 overflow-hidden rounded-2xl border border-gold/35 bg-[linear-gradient(155deg,rgba(240,185,74,0.08),rgba(240,185,74,0)_60%),var(--panel)] p-4 shadow-[0_12px_28px_-14px_rgba(240,185,74,0.35)]">
        {selected.albumArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={selected.albumArt}
            alt=""
            className="h-24 w-24 shrink-0 rounded-xl object-cover shadow-[0_8px_20px_-6px_rgba(0,0,0,0.6)] ring-1 ring-white/10"
          />
        ) : (
          <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-white/5 text-gold ring-1 ring-white/10">
            <Music2 size={30} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[2px] text-gold">Selected</p>
          <p className="mt-1 truncate text-base font-bold leading-snug">{selected.title}</p>
          <p className="truncate text-sm text-muted">{selected.artist}</p>
          <button
            type="button"
            onClick={() => {
              setSelected(null);
              setQuery("");
            }}
            className="mt-2 flex items-center gap-1.5 rounded-full border border-white/15 px-3 py-1.5 text-[11px] font-medium text-muted transition-colors hover:border-white/30 hover:text-foreground"
          >
            <RefreshCw size={11} /> Change song
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search song or artist..."
          className="w-full rounded-xl border border-white/10 bg-panel py-3 pl-10 pr-4 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
        />
      </div>

      {loading && <p className="mt-2 text-xs text-muted">Searching...</p>}

      {results.length > 0 && (
        <div className="mt-2 flex flex-col gap-1.5 rounded-2xl border border-white/10 bg-panel p-2">
          {results.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => {
                setSelected(track);
                onSelect(track);
              }}
              className="flex items-center gap-3.5 rounded-xl px-2 py-2 text-left transition-colors hover:bg-white/5"
            >
              {track.albumArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={track.albumArt}
                  alt=""
                  className="h-14 w-14 shrink-0 rounded-lg object-cover ring-1 ring-white/10"
                />
              ) : (
                <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-white/5 text-gold ring-1 ring-white/10">
                  <Music2 size={20} />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{track.title}</p>
                <p className="truncate text-xs text-muted">{track.artist}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
