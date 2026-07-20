"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, ImageOff } from "lucide-react";

interface Photo {
  path: string;
  url: string;
}

const FADE_MS = 2000;

// Ends fade to transparent so the banner blends into the page background
// with no visible card edge, per the "borderless, ends fade out" request.
const EDGE_FADE_MASK = "linear-gradient(to right, transparent, black 12%, black 88%, transparent)";

/**
 * Rotating photo banner backed by the "crate-builder-photos" Supabase
 * Storage bucket. `section` scopes a folder within that bucket (e.g.
 * "hero", "studio-gallery") so multiple independent photo areas can
 * exist on the same page. Any signed-in DJ can add/remove photos —
 * this page is already behind the DJ login, same as the rest of
 * Crate Builder.
 */
export function PhotoBanner({
  section,
  title,
  height = 260,
  rotateMs = 30000,
}: {
  section: string;
  title: string;
  height?: number;
  rotateMs?: number;
}) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [fadeIn, setFadeIn] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fadeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/dj/library/photos?section=${encodeURIComponent(section)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load photos");
      setPhotos(data.photos);
      setActiveIndex((i) => (data.photos.length > 0 ? i % data.photos.length : 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load photos");
    }
  }, [section]);

  useEffect(() => {
    // Standard fetch-on-mount/section-change pattern; load()'s internal
    // setState calls are async (after the fetch resolves), not synchronous.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  // Plain value setter (not a functional setState updater) — React Strict
  // Mode double-invokes updater callbacks to catch impurities, and this
  // function has real side effects (setPrevIndex, setTimeout), which was
  // causing the rotation to occasionally snap back a step in dev mode.
  function goTo(newIndex: number) {
    if (newIndex === activeIndex) return;
    setPrevIndex(activeIndex);
    setActiveIndex(newIndex);
    setFadeIn(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setFadeIn(true)));
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    fadeTimeoutRef.current = setTimeout(() => setPrevIndex(null), FADE_MS + 100);
  }

  useEffect(() => {
    if (!photos || photos.length <= 1) return;
    const timer = setInterval(() => goTo((activeIndex + 1) % photos.length), rotateMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photos, rotateMs, activeIndex]);

  useEffect(() => () => {
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
  }, []);

  async function handleUpload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("section", section);
      form.append("photo", file);
      const res = await fetch("/api/dj/library/photos", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove(path: string) {
    if (!confirm("Remove this photo?")) return;
    try {
      const res = await fetch("/api/dj/library/photos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove photo");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove photo");
    }
  }

  const current = photos && photos.length > 0 ? photos[activeIndex] : null;
  const prev = photos && prevIndex !== null ? photos[prevIndex] : null;

  return (
    <div className="relative flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</p>
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUpload(file);
              e.target.value = "";
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-1.5 rounded-full border border-gold/40 px-3 py-1.5 text-xs font-semibold text-gold hover:bg-gold/10 disabled:opacity-40"
          >
            <Plus size={13} /> {uploading ? "Uploading…" : "Add Photo"}
          </button>
        </div>
      </div>

      {error && <p className="px-1 text-xs text-status-declined">{error}</p>}

      <div className="relative w-full overflow-hidden" style={{ height }}>
        {current ? (
          <>
            {prev && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={prev.url}
                alt=""
                aria-hidden
                className="absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out"
                style={{
                  transitionDuration: `${FADE_MS}ms`,
                  opacity: fadeIn ? 0 : 1,
                  maskImage: EDGE_FADE_MASK,
                  WebkitMaskImage: EDGE_FADE_MASK,
                }}
              />
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={current.path}
              src={current.url}
              alt={title}
              className="absolute inset-0 h-full w-full object-cover transition-opacity ease-in-out"
              style={{
                transitionDuration: `${FADE_MS}ms`,
                opacity: prev ? (fadeIn ? 1 : 0) : 1,
                maskImage: EDGE_FADE_MASK,
                WebkitMaskImage: EDGE_FADE_MASK,
              }}
            />

            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />

            {photos && photos.length > 1 && (
              <>
                <button
                  onClick={() => goTo((activeIndex - 1 + photos.length) % photos.length)}
                  className="absolute left-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => goTo((activeIndex + 1) % photos.length)}
                  className="absolute right-2 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/40 text-white hover:bg-black/60"
                >
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5">
                  {photos.map((p, i) => (
                    <button
                      key={p.path}
                      onClick={() => goTo(i)}
                      className={`h-1.5 rounded-full transition-all ${i === activeIndex ? "w-5 bg-gold" : "w-1.5 bg-white/40"}`}
                    />
                  ))}
                </div>
              </>
            )}

            <button
              onClick={() => handleRemove(current.path)}
              className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/40 text-white hover:bg-status-declined/80"
              title="Remove this photo"
            >
              <Trash2 size={13} />
            </button>
          </>
        ) : photos && photos.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted">
            <ImageOff size={24} />
            <p className="text-xs">No photos yet — add one to get started.</p>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-muted">Loading…</div>
        )}
      </div>
    </div>
  );
}
