"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Music4, Heart } from "lucide-react";
import { mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";

const STATUS_LABEL: Record<string, string> = {
  pending_confirmation: "STARTING SOON",
  confirmed: "REQUESTS OPEN",
  live: "LIVE NOW",
  ended: "EVENT ENDED",
  declined: "EVENT CANCELED",
};

export function EventHero({
  eventCode,
  title,
  venueName,
  djName,
  djPhoto,
  status,
  paused,
  heroSettings,
}: {
  eventCode: string;
  title: string;
  venueName?: string | null;
  djName?: string | null;
  djPhoto?: string | null;
  status?: string;
  paused?: boolean;
  heroSettings?: Partial<HeroSettings> | null;
}) {
  const settings = mergeHeroSettings(heroSettings);
  const [scrollY, setScrollY] = useState(0);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf = 0;
    function onScroll() {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const y = window.scrollY;
        setScrollY(y);
        const h = heroRef.current?.offsetHeight ?? 420;
        setCollapsed(y > h * 0.7);
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  const parallax = Math.min(scrollY * 0.25, 60);
  const scrollScale = Math.max(1 - scrollY / 3000, 1) + Math.max((60 - scrollY) / 3000, 0);
  const zoomScale = settings.zoom / 100;
  const statusLabel = STATUS_LABEL[status ?? ""] ?? (paused ? "REQUESTS PAUSED" : "LIVE EVENT");

  return (
    <>
      {/* Sticky collapsed header */}
      <div
        className={`fixed left-1/2 top-0 z-40 w-full max-w-md -translate-x-1/2 border-b border-white/8 bg-black/85 backdrop-blur-lg transition-all duration-300 ${
          collapsed ? "translate-y-0 opacity-100" : "-translate-y-full opacity-0"
        }`}
      >
        <div className="flex items-center gap-3 px-4 py-2.5">
          <span className="h-8 w-8 shrink-0 overflow-hidden rounded-full border border-gold/40 bg-panel">
            {djPhoto && (
              <Image
                src={djPhoto}
                alt={djName ?? ""}
                width={32}
                height={32}
                className="h-full w-full object-cover"
                style={{ objectPosition: `${settings.xPosition}% ${settings.yPosition}%` }}
              />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold">{title}</p>
            <p className="truncate text-[10px] text-muted">{venueName}</p>
          </div>
          {!paused && (
            <Link
              href={`/r/${eventCode}/request`}
              className="shrink-0 rounded-full bg-gold px-3 py-1.5 text-[10px] font-bold text-black"
            >
              Request
            </Link>
          )}
        </div>
      </div>

      {/* Full-bleed within the app's mobile-app-style max-w-md column (already edge-to-edge, no breakout needed) */}
      <div className="relative w-full">
        <div
          ref={heroRef}
          className="relative h-[420px] overflow-hidden sm:h-[500px] lg:h-[640px]"
          style={{ transform: `translateY(${parallax * 0.3}px)` }}
        >
          {/* Layer 1: image or luxury fallback */}
          <div
            className="absolute inset-0 transition-opacity duration-500"
            style={{ transform: `scale(${scrollScale * zoomScale})`, opacity: imgLoaded || !djPhoto ? 1 : 0 }}
          >
            {djPhoto ? (
              <Image
                src={djPhoto}
                alt={djName ?? "DJ"}
                fill
                sizes="100vw"
                className="object-cover"
                style={{ objectPosition: `${settings.xPosition}% ${settings.yPosition}%` }}
                priority
                onLoad={() => setImgLoaded(true)}
              />
            ) : (
              <div
                className="h-full w-full"
                style={{
                  background:
                    "radial-gradient(120% 140% at 85% 0%, rgba(240,185,74,0.16), transparent 60%), radial-gradient(80% 100% at 10% 100%, rgba(240,185,74,0.08), transparent 55%), linear-gradient(160deg, #1a1610 0%, #0d0d0d 55%, #0a0a0a 100%)",
                }}
              />
            )}
          </div>

          {/* Shimmer placeholder while loading */}
          {djPhoto && !imgLoaded && (
            <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-panel via-dark3 to-panel" />
          )}

          {/* Layer 4: gold glow behind subject */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "radial-gradient(45% 60% at 75% 40%, rgba(240,185,74,0.22), transparent 70%)" }}
          />
          {/* Layer 3: dark overlay */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ backgroundColor: `rgba(0,0,0,${settings.overlayDarkness / 100})` }}
          />
          {/* Layer 6: left gradient for legibility */}
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 45%, transparent 75%)" }}
          />
          {/* Layer 5: bottom gradient, melts into page */}
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 h-[65%]"
            style={{ background: "linear-gradient(to top, rgba(0,0,0,0.97) 0%, transparent 100%)" }}
          />

          {/* Content */}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 px-5 pb-12">
            <span className="w-fit rounded-full border border-gold/50 bg-black/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[2px] text-gold backdrop-blur-sm">
              {statusLabel}
            </span>
            <h1 className="gold-text-gradient text-4xl font-extrabold leading-[1.05] sm:text-5xl">{title}</h1>
            {djName && <p className="text-sm font-medium text-white/85">with {djName}</p>}
            <p className="font-mono text-[11px] text-gold/80">
              Event Code: {eventCode}
              {venueName && <span className="text-white/60"> · {venueName}</span>}
            </p>

            <div className="mt-2 flex gap-2.5">
              {!paused ? (
                <Link
                  href={`/r/${eventCode}/request`}
                  className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[var(--gold-light)] to-[var(--gold)] px-5 py-3 text-sm font-bold text-black btn-gold-solid"
                >
                  <Music4 size={16} /> Request a Song
                </Link>
              ) : (
                <span className="flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-5 py-3 text-sm font-semibold text-muted backdrop-blur-sm">
                  <Music4 size={16} /> Requests Paused
                </span>
              )}
              <Link
                href={`/r/${eventCode}/tip`}
                className="flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 py-3 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/15"
              >
                <Heart size={16} /> Tip the DJ
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
