"use client";

import { useEffect, useState } from "react";
import { Search, Music2 } from "lucide-react";

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
      <div className="flex items-center gap-3 rounded-xl border border-gold/30 bg-panel px-4 py-3">
        {selected.albumArt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={selected.albumArt} alt="" className="h-10 w-10 shrink-0 rounded object-cover" />
        ) : (
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-white/5 text-gold">
            <Music2 size={16} />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{selected.title}</p>
          <p className="truncate text-xs text-muted">{selected.artist}</p>
        </div>
        <button
          type="button"
          onClick={() => {
            setSelected(null);
            setQuery("");
          }}
          className="shrink-0 text-xs text-muted underline underline-offset-4"
        >
          Change
        </button>
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
        <div className="mt-2 flex flex-col gap-1 rounded-xl border border-white/10 bg-panel p-1.5">
          {results.map((track) => (
            <button
              key={track.id}
              type="button"
              onClick={() => {
                setSelected(track);
                onSelect(track);
              }}
              className="flex items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-white/5"
            >
              {track.albumArt ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={track.albumArt} alt="" className="h-9 w-9 shrink-0 rounded object-cover" />
              ) : (
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded bg-white/5 text-gold">
                  <Music2 size={14} />
                </span>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm">{track.title}</p>
                <p className="truncate text-xs text-muted">{track.artist}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
