"use client";

import { useState } from "react";
import { SongSearch } from "@/components/guest/song-search";
import { Search } from "lucide-react";

export function SongSlotField({
  label,
  value,
  onChange,
  required
}: {
  label: string;
  value: string;
  onChange: (text: string, spotifyId?: string) => void;
  required?: boolean;
}) {
  const [searching, setSearching] = useState(false);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">
          {label}
          {required && <span className="text-status-declined"> *</span>}
        </span>
        <button
          type="button"
          onClick={() => setSearching((v) => !v)}
          className="flex shrink-0 items-center gap-1 text-xs text-gold hover:underline"
        >
          <Search size={11} /> {searching ? "Type instead" : "Search Spotify"}
        </button>
      </div>
      {searching ? (
        <SongSearch
          onSelect={(track) => {
            onChange(`${track.artist} - ${track.title}`, track.id);
            setSearching(false);
          }}
        />
      ) : (
        <input
          value={value}
          onChange={(e) => onChange(e.target.value, undefined)}
          placeholder="Artist - Song"
          className="w-full rounded-[10px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
        />
      )}
    </div>
  );
}
