"use client";

import { useState } from "react";
import Image from "next/image";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { MessageCircle, ChevronRight } from "lucide-react";
import { mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";
import { DjProfileModal } from "@/components/portal/dj-profile-modal";

export function DjProfileCard({
  name,
  photoUrl,
  heroSettings,
  bio,
  onStartConversation
}: {
  name: string | null;
  photoUrl: string | null;
  heroSettings: Partial<HeroSettings> | null;
  bio: string | null;
  onStartConversation: () => void;
}) {
  const [showProfile, setShowProfile] = useState(false);
  const settings = mergeHeroSettings(heroSettings);

  if (!name) {
    return (
      <GlassCard className="flex flex-col gap-2">
        <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Your DJ</p>
        <p className="text-sm text-muted">Not assigned yet — we&rsquo;ll introduce you as soon as they&rsquo;re booked.</p>
      </GlassCard>
    );
  }

  return (
    <>
      <GlassCard className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[1.5px] text-muted">Meet your DJ</p>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">Your partner for an unforgettable day</p>
        </div>

        <div className="flex gap-4">
          <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[14px] border border-gold/30">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt={name}
                fill
                sizes="96px"
                className="object-cover"
                style={{ objectPosition: `${settings.xPosition}% ${settings.yPosition}%`, transform: `scale(${settings.zoom / 100})` }}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[var(--gold-light)] to-[var(--gold-dim)] font-display text-2xl text-[#1A140A]">
                {name.charAt(0)}
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-wide text-muted">Your assigned DJ</p>
            <p className="font-display text-2xl italic">{name}</p>
            <button onClick={() => setShowProfile(true)} className="mt-1 flex items-center gap-0.5 text-xs font-medium text-gold hover:underline">
              Profile preview <ChevronRight size={12} />
            </button>
          </div>
        </div>

        {bio && <p className="text-xs leading-relaxed text-muted">{bio}</p>}

        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="primary" size="sm" onClick={onStartConversation} className="flex-1">
            <MessageCircle size={14} /> Start a conversation
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowProfile(true)} className="flex-1">
            View profile
          </Button>
        </div>
      </GlassCard>

      {showProfile && (
        <DjProfileModal name={name} photoUrl={photoUrl} heroSettings={heroSettings} bio={bio} onClose={() => setShowProfile(false)} />
      )}
    </>
  );
}
