"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { Music2, Square } from "lucide-react";

interface NowPlaying {
  key: string;
  label: string;
}

interface MasterPlayerContextValue {
  nowPlayingKey: string | null;
  isPlaying: (key: string) => boolean;
  play: (key: string, label: string, file: File) => Promise<void>;
  stop: () => void;
}

const MasterPlayerContext = createContext<MasterPlayerContextValue | null>(null);

/**
 * Single shared audio player for the whole page. Every track-preview
 * button (Manual Crate Builder, Crate Detail View, anywhere else) goes
 * through this instead of keeping its own private <audio> element, so
 * starting one preview always stops whatever else was playing — plus a
 * persistent "now playing" bar with a Stop control reachable from
 * anywhere on the page.
 */
export function MasterPlayerProvider({ children }: { children: React.ReactNode }) {
  const [nowPlaying, setNowPlaying] = useState<NowPlaying | null>(null);
  const nowPlayingKeyRef = useRef<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  // Bumped on every play()/stop() so an in-flight play() call that gets
  // superseded (rapid clicks on different tracks) can tell its result is
  // stale and bail out instead of clobbering newer state.
  const tokenRef = useRef(0);

  const stop = useCallback(() => {
    tokenRef.current++;
    audioRef.current?.pause();
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
    nowPlayingKeyRef.current = null;
    setNowPlaying(null);
  }, []);

  const play = useCallback(
    async (key: string, label: string, file: File) => {
      // Clicking the currently-playing track again just stops it.
      if (nowPlayingKeyRef.current === key) {
        stop();
        return;
      }

      stop(); // always fully stop/release whatever else was playing first
      const token = ++tokenRef.current;
      const url = URL.createObjectURL(file);
      objectUrlRef.current = url;
      if (!audioRef.current) audioRef.current = new Audio();
      audioRef.current.src = url;
      audioRef.current.onended = () => {
        if (tokenRef.current !== token) return;
        nowPlayingKeyRef.current = null;
        setNowPlaying(null);
      };
      try {
        await audioRef.current.play();
      } catch {
        return; // interrupted by a newer play()/stop() — that call owns state now
      }
      if (tokenRef.current !== token) return; // superseded while awaiting
      nowPlayingKeyRef.current = key;
      setNowPlaying({ key, label });
    },
    [stop]
  );

  const isPlaying = useCallback((key: string) => nowPlaying?.key === key, [nowPlaying]);

  return (
    <MasterPlayerContext.Provider value={{ nowPlayingKey: nowPlaying?.key ?? null, isPlaying, play, stop }}>
      {children}
      <div className="fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-gold/30 bg-black/90 px-4 py-2.5 shadow-lg shadow-black/50 backdrop-blur">
        {nowPlaying ? (
          <>
            <span className="size-2 shrink-0 animate-pulse rounded-full bg-gold" />
            <span className="max-w-[240px] truncate text-xs text-white">{nowPlaying.label}</span>
            <button
              onClick={stop}
              className="flex shrink-0 items-center gap-1 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white hover:bg-white/20"
            >
              <Square size={11} /> Stop
            </button>
          </>
        ) : (
          <>
            <Music2 size={13} className="shrink-0 text-muted" />
            <span className="text-xs text-muted">Nothing playing</span>
          </>
        )}
      </div>
    </MasterPlayerContext.Provider>
  );
}

export function useMasterPlayer(): MasterPlayerContextValue {
  const ctx = useContext(MasterPlayerContext);
  if (!ctx) throw new Error("useMasterPlayer must be used within MasterPlayerProvider");
  return ctx;
}
