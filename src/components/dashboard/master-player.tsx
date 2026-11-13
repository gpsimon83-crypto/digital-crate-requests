"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { fmtTime } from "@/lib/audio/time";
import { cn } from "@/lib/utils";
import {
  IconClose,
  IconExpand,
  IconMinimize,
  IconMore,
  IconNext,
  IconNote,
  IconPause,
  IconPlay,
  IconPrev,
  IconQueue,
  IconRepeat,
  IconVolume
} from "@/components/player/player-icons";

interface Track {
  key: string;
  label: string;
  title: string;
  artist: string;
  file: File;
}

interface MasterPlayerContextValue {
  nowPlayingKey: string | null;
  isPlaying: (key: string) => boolean;
  play: (key: string, label: string, file: File) => Promise<void>;
  stop: () => void;
}

const MasterPlayerContext = createContext<MasterPlayerContextValue | null>(null);
const RECENT_MAX = 30;

/** "Artist — Title" / "Artist - Title" → parts; anything else is just a title. */
function splitLabel(label: string): { title: string; artist: string } {
  const m = /^(.+?)\s+[—–-]\s+(.+)$/.exec(label.trim());
  return m ? { artist: m[1].trim(), title: m[2].trim() } : { title: label.trim() || "Untitled", artist: "" };
}

function readVolume() {
  try {
    const v = Number(window.localStorage.getItem("dcp-volume"));
    return Number.isFinite(v) && v >= 0 && v <= 1 && window.localStorage.getItem("dcp-volume") !== null ? v : 0.85;
  } catch {
    return 0.85;
  }
}

/**
 * Single shared audio player for the page. Every track-preview button goes
 * through this (`play(key, label, file)`), so starting one preview stops
 * whatever else was playing. Clicking the playing track again stops it.
 *
 * The player is a full-width bar along the bottom: artwork + title, previous / play-pause / next through
 * the songs previewed this session, repeat (loop this song), seek,
 * volume, the recently
 * played list, minimize and close. Close stops playback, nothing keeps
 * playing hidden.
 */
export function MasterPlayerProvider({ children }: { children: React.ReactNode }) {
  const [recent, setRecent] = useState<Track[]>([]);
  const [index, setIndex] = useState(-1);
  const [visible, setVisible] = useState(false);
  const [ended, setEnded] = useState(false);
  const [paused, setPaused] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(NaN);
  const [volume, setVolume] = useState(0.85);
  const [muted, setMuted] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [panel, setPanel] = useState<null | "queue" | "more">(null);
  const [scrub, setScrub] = useState<number | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const tokenRef = useRef(0);
  const recentRef = useRef<Track[]>([]);
  const indexRef = useRef(-1);

  const track = index >= 0 ? recent[index] ?? null : null;

  // One audio element for the page, with its listeners.
  useEffect(() => {
    const a = new Audio();
    a.preload = "metadata";
    audioRef.current = a;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the saved volume only exists in the browser
    setVolume(readVolume());
    const on = (ev: string, fn: () => void) => a.addEventListener(ev, fn);
    on("play", () => {
      setPaused(false);
      setEnded(false);
    });
    on("pause", () => setPaused(true));
    on("playing", () => setLoading(false));
    on("waiting", () => setLoading(true));
    on("canplay", () => setLoading(false));
    on("timeupdate", () => setTime(a.currentTime));
    on("durationchange", () => setDuration(a.duration));
    on("loadedmetadata", () => setDuration(a.duration));
    on("error", () => {
      if (!a.getAttribute("src")) return;
      setLoading(false);
      setPaused(true);
      setError("This file couldn't be played.");
    });
    on("ended", () => {
      if (a.loop) return;
      setPaused(true);
      setEnded(true);
    });
    return () => {
      a.pause();
      a.removeAttribute("src");
      a.load();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  useEffect(() => {
    const a = audioRef.current;
    if (a) a.volume = muted ? 0 : volume;
    try {
      window.localStorage.setItem("dcp-volume", String(volume));
    } catch {
      /* private mode */
    }
  }, [volume, muted]);

  useEffect(() => {
    if (audioRef.current) audioRef.current.loop = repeat;
  }, [repeat]);

  const loadAndPlay = useCallback(async (list: Track[], i: number) => {
    const a = audioRef.current;
    const t = list[i];
    if (!a || !t) return;
    const token = ++tokenRef.current;
    a.pause();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(t.file);
    urlRef.current = url;
    indexRef.current = i;
    setIndex(i);
    setVisible(true);
    setError(null);
    setEnded(false);
    setTime(0);
    setDuration(NaN);
    setLoading(true);
    a.src = url;
    try {
      await a.play();
    } catch (e) {
      if (tokenRef.current !== token) return; // superseded by a newer play()/stop()
      setLoading(false);
      if ((e as DOMException)?.name !== "AbortError") setError("Press play to start.");
      return;
    }
  }, []);

  const stop = useCallback(() => {
    tokenRef.current++;
    const a = audioRef.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
    indexRef.current = -1;
    setIndex(-1);
    setVisible(false);
    setPaused(true);
    setEnded(false);
    setLoading(false);
    setPanel(null);
    setMinimized(false);
  }, []);

  const play = useCallback(
    async (key: string, label: string, file: File) => {
      const cur = recentRef.current[indexRef.current];
      // Clicking the currently-playing track again just stops it.
      if (cur && cur.key === key) {
        stop();
        return;
      }
      const parts = splitLabel(label);
      const next = [{ key, label, file, ...parts }, ...recentRef.current.filter((t) => t.key !== key)].slice(0, RECENT_MAX);
      recentRef.current = next;
      setRecent(next);
      await loadAndPlay(next, 0);
    },
    [loadAndPlay, stop]
  );

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a || !track) return;
    if (a.paused) {
      setError(null);
      void a.play().catch(() => setError("Press play to start."));
    } else a.pause();
  }, [track]);

  // "Previous" restarts the song after the first 3 seconds, like most players.
  const prev = () => {
    const a = audioRef.current;
    if (a && a.currentTime > 3) {
      a.currentTime = 0;
      return;
    }
    if (index < recent.length - 1) void loadAndPlay(recent, index + 1);
    else if (a) a.currentTime = 0;
  };
  const next = () => {
    if (index > 0) void loadAndPlay(recent, index - 1);
  };

  const seekTo = (v: number) => {
    const a = audioRef.current;
    if (a && Number.isFinite(a.duration)) {
      a.currentTime = Math.max(0, Math.min(a.duration, v));
      setTime(a.currentTime);
    }
    setScrub(null);
  };

  const isPlaying = useCallback((key: string) => !!track && track.key === key && !ended, [track, ended]);
  const value = useMemo(() => ({ nowPlayingKey: track && !ended ? track.key : null, isPlaying, play, stop }), [track, ended, isPlaying, play, stop]);

  const known = Number.isFinite(duration) && duration > 0;
  const shown = scrub ?? time;
  const pct = known ? Math.min(100, (shown / duration) * 100) : 0;
  const vol = muted ? 0 : volume;
  const playLabel = paused ? `Play ${track?.title ?? ""}` : `Pause ${track?.title ?? ""}`;
  const btn = "grid size-11 shrink-0 place-items-center rounded-full text-[#e9dfcd] transition-[color,background-color,transform] duration-150 hover:bg-white/[0.07] hover:text-[#ffd27a] active:scale-95 disabled:pointer-events-none disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0b84f] focus-visible:ring-offset-2 focus-visible:ring-offset-[#120f0b] motion-reduce:transition-none motion-reduce:active:scale-100";
  const on = "text-[#ffbf4a] [filter:drop-shadow(0_0_6px_rgba(255,180,70,0.55))]";
  const range =
    "dcp-range h-11 w-full cursor-pointer appearance-none bg-transparent focus-visible:outline-none disabled:cursor-default [&::-webkit-slider-runnable-track]:h-[5px] [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-[linear-gradient(90deg,#c8781c,#ffc65a_var(--p),rgba(255,255,255,0.14)_var(--p))] [&::-webkit-slider-thumb]:-mt-[5.5px] [&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[#fff1d0] [&::-webkit-slider-thumb]:bg-[#ffb93f] [&::-webkit-slider-thumb]:shadow-[0_0_10px_rgba(255,185,63,0.8)] focus-visible:[&::-webkit-slider-thumb]:ring-4 focus-visible:[&::-webkit-slider-thumb]:ring-[#f0b84f]/50 [&::-moz-range-track]:h-[5px] [&::-moz-range-track]:rounded-full [&::-moz-range-track]:bg-white/15 [&::-moz-range-progress]:h-[5px] [&::-moz-range-progress]:rounded-full [&::-moz-range-progress]:bg-[#ffb93f] [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[#fff1d0] [&::-moz-range-thumb]:bg-[#ffb93f]";

  const art = (size: string) => (
    <span className={cn("grid shrink-0 place-items-center overflow-hidden rounded-[12px] border border-[#c98a35]/40 bg-[radial-gradient(circle_at_30%_25%,#4a3416,#120d07_70%)] text-[#ffc65a] shadow-[0_6px_18px_rgba(0,0,0,0.5)]", size)}>
      <IconNote className="size-1/2" />
    </span>
  );

  const playButton = (big: boolean) => (
    <button
      type="button"
      onClick={togglePlay}
      aria-label={playLabel}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full bg-[radial-gradient(circle_at_35%_30%,#ffe2a1,#ffb43a_45%,#d9861e)] text-[#1a1006] shadow-[0_0_0_4px_rgba(255,180,60,0.12),0_0_26px_rgba(255,170,50,0.5)] transition-[transform,box-shadow] duration-150 hover:shadow-[0_0_0_5px_rgba(255,180,60,0.18),0_0_34px_rgba(255,170,50,0.65)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#fff1d0] focus-visible:ring-offset-2 focus-visible:ring-offset-[#120f0b] motion-reduce:transition-none",
        big ? "size-[52px]" : "size-12"
      )}
    >
      {paused ? <IconPlay className="ml-0.5 size-6" /> : <IconPause className="size-6" />}
      {loading && <span aria-hidden className="absolute -inset-1 animate-spin rounded-full border-2 border-transparent border-t-[#fff1d0] motion-reduce:animate-none" />}
    </button>
  );

  const volumeControl = (
    <div className="flex items-center gap-1">
      <button type="button" className={btn} onClick={() => setMuted((m) => !m)} aria-label={muted ? "Unmute" : "Mute"} aria-pressed={muted}>
        <IconVolume level={vol} className="size-[22px]" />
      </button>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(vol * 100)}
        onChange={(e) => {
          setVolume(Number(e.target.value) / 100);
          setMuted(false);
        }}
        aria-label="Volume"
        aria-valuetext={`${Math.round(vol * 100)}%`}
        className={cn(range, "w-[110px]")}
        style={{ ["--p" as string]: `${vol * 100}%` }}
      />
    </div>
  );

  const queuePanel = panel === "queue" && (
    <div role="dialog" aria-label="Recently played" className="absolute bottom-[calc(100%+10px)] right-2 z-10 w-[min(360px,calc(100vw-32px))] rounded-[16px] border border-[#c98a35]/40 bg-[#14100b]/95 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e5b647]">Recently played</p>
      <ul className="max-h-[320px] overflow-y-auto">
        {recent.map((t, i) => (
          <li key={t.key}>
            <button
              type="button"
              onClick={() => {
                setPanel(null);
                void loadAndPlay(recent, i);
              }}
              aria-current={i === index ? "true" : undefined}
              className={cn("flex min-h-11 w-full items-center gap-3 rounded-[10px] px-2 text-left text-sm hover:bg-white/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0b84f]", i === index && "bg-[#c98a35]/15")}
            >
              <span className={cn("w-4 text-center text-xs", i === index ? "text-[#ffbf4a]" : "text-[#8f8574]")}>{i === index ? "▶" : i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[#f6efe2]">{t.title}</span>
                {t.artist && <span className="block truncate text-xs text-[#a89c88]">{t.artist}</span>}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );

  const morePanel = panel === "more" && (
    <div role="dialog" aria-label="More player controls" className="absolute bottom-[calc(100%+10px)] right-2 z-10 w-[min(300px,calc(100vw-32px))] space-y-1 rounded-[16px] border border-[#c98a35]/40 bg-[#14100b]/95 p-2 shadow-[0_18px_40px_rgba(0,0,0,0.6)] backdrop-blur-xl">
      <button type="button" onClick={() => setRepeat((r) => !r)} aria-pressed={repeat} className={cn("flex min-h-11 w-full items-center gap-3 rounded-[10px] px-2 text-sm text-[#e9dfcd] hover:bg-white/[0.06]", repeat && "text-[#ffbf4a]")}>
        <IconRepeat one className="size-5" /> Repeat this song {repeat ? "(on)" : "(off)"}
      </button>
      <div className="px-1">{volumeControl}</div>
      <button type="button" onClick={() => setPanel("queue")} className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-2 text-sm text-[#e9dfcd] hover:bg-white/[0.06]">
        <IconQueue className="size-5" /> Recently played ({recent.length})
      </button>
      <button type="button" onClick={() => { setPanel(null); setMinimized(true); }} className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-2 text-sm text-[#e9dfcd] hover:bg-white/[0.06]">
        <IconMinimize className="size-5" /> Minimize player
      </button>
      <button type="button" onClick={stop} className="flex min-h-11 w-full items-center gap-3 rounded-[10px] px-2 text-sm text-[#f1a59d] hover:bg-white/[0.06]">
        <IconClose className="size-5" /> Close and stop
      </button>
    </div>
  );

  const seek = (
    <div className="flex items-center gap-3">
      <span className="w-11 shrink-0 text-right text-xs tabular-nums text-[#d9cdb7]">{fmtTime(shown)}</span>
      <input
        type="range"
        min={0}
        max={known ? duration : 1}
        step={1}
        value={known ? shown : 0}
        disabled={!known}
        onChange={(e) => setScrub(Number(e.target.value))}
        onPointerUp={(e) => seekTo(Number((e.target as HTMLInputElement).value))}
        onKeyUp={(e) => seekTo(Number((e.target as HTMLInputElement).value))}
        onBlur={() => scrub !== null && seekTo(scrub)}
        aria-label="Seek"
        aria-valuetext={known ? `${fmtTime(shown)} of ${fmtTime(duration)}` : "Duration unknown"}
        className={range}
        style={{ ["--p" as string]: `${pct}%` }}
      />
      <span className="w-11 shrink-0 text-xs tabular-nums text-[#d9cdb7]">{fmtTime(duration)}</span>
    </div>
  );

  return (
    <MasterPlayerContext.Provider value={value}>
      {children}
      {visible && <div aria-hidden className={minimized ? "h-24" : "h-[150px] lg:h-24"} />}
      {visible && track && (
        <div className={cn("pointer-events-none fixed inset-x-0 z-50 flex justify-center", minimized ? "px-3" : "bottom-0")} style={minimized ? { bottom: "calc(env(safe-area-inset-bottom, 0px) + 12px)" } : undefined}>
          {minimized ? (
            <div role="region" aria-label="Audio player (minimized)" className="pointer-events-auto flex max-w-[min(440px,100%)] items-center gap-2 rounded-full border border-[#c98a35]/50 bg-[#15110c]/90 py-1.5 pl-1.5 pr-2 shadow-[0_14px_36px_rgba(0,0,0,0.55),0_0_24px_rgba(255,170,50,0.12)] backdrop-blur-xl">
              {art("size-10 rounded-full")}
              <span className="min-w-0 flex-1 truncate px-1 text-sm text-[#f6efe2]">{track.title}</span>
              {playButton(false)}
              <button type="button" className={btn} onClick={() => setMinimized(false)} aria-label="Expand player">
                <IconExpand className="size-5" />
              </button>
              <button type="button" className={btn} onClick={stop} aria-label="Close player and stop">
                <IconClose className="size-5" />
              </button>
            </div>
          ) : (
            <div
              role="region"
              aria-label="Audio player"
              onKeyDown={(e) => e.key === "Escape" && setPanel(null)}
              className="pointer-events-auto relative w-full border-t border-[#c98a35]/45 bg-[linear-gradient(180deg,rgba(30,23,15,0.94),rgba(10,9,8,0.97))] px-3 pt-2 text-[#f6efe2] shadow-[0_-12px_36px_rgba(0,0,0,0.5),0_-1px_24px_rgba(255,160,40,0.08),inset_0_1px_0_rgba(255,255,255,0.05)] backdrop-blur-xl sm:px-6 lg:pt-2.5"
              style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 10px)" }}
            >
              <span aria-hidden className="pointer-events-none absolute inset-x-[10%] -top-px h-px bg-[linear-gradient(90deg,transparent,rgba(255,180,70,0.85),transparent)]" />
              <span aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(50%_140%_at_50%_140%,rgba(255,160,40,0.08),transparent_60%)]" />
              {queuePanel}
              {morePanel}
              <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1 lg:flex-nowrap lg:gap-x-4">
                {/* Track */}
                <div className="flex min-w-0 flex-1 items-center gap-3 lg:w-[250px] lg:flex-none">
                  {art("size-12 lg:size-[52px]")}
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold leading-tight text-[#fff6e6] lg:text-base">{track.title}</p>
                    <p className={cn("truncate text-xs lg:text-[13px]", error ? "text-[#f1a59d]" : "text-[#b8ab95]")} role={error ? "status" : undefined}>
                      {error ?? (track.artist || "Preview")}
                    </p>
                  </div>
                </div>
                <span aria-hidden className="hidden h-10 w-px bg-white/10 lg:block" />
                {/* Transport */}
                <div className="flex items-center gap-1">
                  <button type="button" className={btn} onClick={prev} aria-label="Previous song (or restart this one)">
                    <IconPrev className="size-[22px]" />
                  </button>
                  {playButton(true)}
                  <button type="button" className={btn} onClick={next} disabled={index <= 0} aria-label="Next song">
                    <IconNext className="size-[22px]" />
                  </button>
                </div>
                <span aria-hidden className="hidden h-10 w-px bg-white/10 lg:block" />
                <button type="button" className={cn(btn, "hidden lg:grid", repeat && on)} onClick={() => setRepeat((r) => !r)} aria-pressed={repeat} aria-label="Repeat this song">
                  <IconRepeat one={repeat} className="size-[22px]" />
                </button>
                <button type="button" className={cn(btn, "lg:hidden")} onClick={() => setPanel((p) => (p === "more" ? null : "more"))} aria-expanded={panel === "more"} aria-label="More player controls">
                  <IconMore className="size-[22px]" />
                </button>
                {/* Timeline */}
                <div className="order-last w-full min-w-0 lg:order-none lg:w-auto lg:flex-1">{seek}</div>
                <span aria-hidden className="hidden h-10 w-px bg-white/10 lg:block" />
                <div className="hidden lg:block">{volumeControl}</div>
                <span aria-hidden className="hidden h-10 w-px bg-white/10 lg:block" />
                <div className="hidden items-center lg:flex">
                  <button type="button" className={cn(btn, panel === "queue" && on)} onClick={() => setPanel((p) => (p === "queue" ? null : "queue"))} aria-expanded={panel === "queue"} aria-label="Recently played">
                    <IconQueue className="size-[22px]" />
                  </button>
                  <button type="button" className={btn} onClick={() => { setPanel(null); setMinimized(true); }} aria-label="Minimize player">
                    <IconMinimize className="size-[22px]" />
                  </button>
                  <button type="button" className={btn} onClick={stop} aria-label="Close player and stop">
                    <IconClose className="size-[22px]" />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </MasterPlayerContext.Provider>
  );
}

export function useMasterPlayer(): MasterPlayerContextValue {
  const ctx = useContext(MasterPlayerContext);
  if (!ctx) throw new Error("useMasterPlayer must be used within MasterPlayerProvider");
  return ctx;
}
