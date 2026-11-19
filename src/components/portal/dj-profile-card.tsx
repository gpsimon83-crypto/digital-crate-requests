"use client";

import { useState } from "react";
import Image from "next/image";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { MessageCircle, ChevronRight } from "lucide-react";
import { mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";
import { DjProfileModal } from "@/components/portal/dj-profile-modal";
import { cn } from "@/lib/utils";

const PLACEHOLDER = "/portal/tabs/dj-placeholder.webp";

/** Where the booking stands with the DJ, from the event's status. */
function assignment(name: string | null, status: string | null): { label: string; tone: "ok" | "wait" | "none" } {
  if (!name) return { label: "Not assigned yet", tone: "none" };
  if (status === "confirmed" || status === "live" || status === "ended") return { label: "Confirmed for your date", tone: "ok" };
  return { label: "Assigned · confirming your date", tone: "wait" };
}

/**
 * Compact "Your DJ" card: the DJ's real profile photo (headphones photo when
 * there's no DJ yet or no photo), the assignment status, and quick actions.
 */
export function DjProfileCard({
  name,
  photoUrl,
  heroSettings,
  bio,
  status,
  onStartConversation
}: {
  name: string | null;
  photoUrl: string | null;
  heroSettings: Partial<HeroSettings> | null;
  bio: string | null;
  status?: string | null;
  onStartConversation: () => void;
}) {
  const [showProfile, setShowProfile] = useState(false);
  const settings = mergeHeroSettings(heroSettings);
  const a = assignment(name, status ?? null);
  const hasPhoto = !!(name && photoUrl);

  return (
    <>
      <GlassCard className="flex flex-col gap-0 overflow-hidden p-0 lg:self-start" data-tour="portal-dj">
        <div className="relative aspect-[4/3] w-full bg-panel">
          <Image
            src={hasPhoto ? photoUrl! : PLACEHOLDER}
            alt={hasPhoto ? name! : ""}
            fill
            sizes="(min-width: 1024px) 320px, 100vw"
            className="object-cover"
            style={hasPhoto ? { objectPosition: `${settings.xPosition}% ${settings.yPosition}%`, transform: `scale(${settings.zoom / 100})` } : { objectPosition: "50% 42%" }}
          />
        </div>
        <div className="flex flex-col gap-3 p-5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[2.5px] text-muted">Your DJ</p>
            <p className="mt-1 font-display text-2xl leading-tight">{name ?? "To be announced"}</p>
            <p className="mt-1.5 flex items-center gap-1.5 text-xs">
              <span className={cn("h-2 w-2 rounded-full", a.tone === "ok" ? "bg-status-approved" : a.tone === "wait" ? "bg-status-pending" : "bg-[var(--taupe)]")} aria-hidden />
              <span className={a.tone === "none" ? "text-muted" : ""}>{a.label}</span>
            </p>
          </div>
          {name ? (
            <>
              {bio && <p className="line-clamp-3 text-xs leading-relaxed text-muted">{bio}</p>}
              <div className="flex flex-col gap-2">
                <Button variant="secondary" size="sm" onClick={onStartConversation}>
                  <MessageCircle size={14} /> Message your DJ
                </Button>
                <button onClick={() => setShowProfile(true)} className="flex items-center justify-center gap-0.5 rounded-[8px] py-1 text-xs font-medium text-gold-dim hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
                  View profile <ChevronRight size={12} />
                </button>
              </div>
            </>
          ) : (
            <p className="text-xs leading-relaxed text-muted">We&rsquo;ll introduce you as soon as your DJ is booked. Questions in the meantime? Send us a message.</p>
          )}
        </div>
      </GlassCard>

      {showProfile && name && <DjProfileModal name={name} photoUrl={photoUrl} heroSettings={heroSettings} bio={bio} onClose={() => setShowProfile(false)} />}
    </>
  );
}
