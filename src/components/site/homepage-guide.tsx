"use client";

import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/logo";
import {
  MessageCircle,
  X,
  ArrowLeft,
  PartyPopper,
  Music2,
  UserCircle,
  Disc3,
  MapPin,
  Phone,
  ArrowRight
} from "lucide-react";

interface Topic {
  key: string;
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  answer: string;
  cta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
}

const TOPICS: Topic[] = [
  {
    key: "book",
    icon: PartyPopper,
    label: "I want to book a DJ",
    answer:
      "Fill out the booking form below with your event date and details — we respond within 24 hours. Prefer to talk it through first? Book a quick call instead.",
    cta: { label: "Book a call", href: "/schedule" },
    secondaryCta: { label: "Jump to booking form", href: "#booking" }
  },
  {
    key: "requests",
    icon: Music2,
    label: "How do song requests work at the event?",
    answer:
      "At your event, scan the QR code near the DJ booth — no app or account needed. Browse the DJ's crate, request a song, vote on what plays next, and tip your DJ right from your phone."
  },
  {
    key: "portal",
    icon: UserCircle,
    label: "I already booked — where's my portal?",
    answer: "Your Events Portal has your contract, payment status, and night-of details, all in one place.",
    cta: { label: "Go to your portal", href: "/portal/login" }
  },
  {
    key: "dj",
    icon: Disc3,
    label: "I'm a DJ on the team",
    answer: "Head to the staff login to see your bookings and manage your profile.",
    cta: { label: "DJ / Staff login", href: "/dj-dashboard/login" }
  },
  {
    key: "info",
    icon: MapPin,
    label: "Where do you serve, and how fast do you respond?",
    answer:
      "We're based in Wisconsin and serve the greater Wisconsin area and beyond, with 10+ professional DJs on the team for any event type or size. Every booking inquiry gets a response within 24 hours."
  },
  {
    key: "human",
    icon: Phone,
    label: "I'd rather talk to a person",
    answer: "Totally get it — book a short call and we'll walk through everything together.",
    cta: { label: "Book a call", href: "/schedule" }
  }
];

export function HomepageGuide() {
  const [open, setOpen] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const active = TOPICS.find((t) => t.key === activeKey) ?? null;

  function toggle() {
    setOpen((v) => !v);
    if (open) setActiveKey(null);
  }

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {open && (
        <div className="flex max-h-[70vh] w-[calc(100vw-2.5rem)] max-w-sm flex-col overflow-hidden border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <Logo variant="icon" brand="crates-djs" size={22} />
              <div>
                <p className="text-sm font-semibold leading-tight">Need a hand?</p>
                <p className="text-[11px] leading-tight text-muted">A quick guide to Crates DJs</p>
              </div>
            </div>
            <button onClick={toggle} className="text-muted hover:text-foreground" aria-label="Close guide">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!active && (
              <>
                <p className="mb-3 text-sm text-muted">Pick what you&rsquo;re here for:</p>
                <div className="flex flex-col divide-y divide-border border-y border-border">
                  {TOPICS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setActiveKey(t.key)}
                      className="group flex items-center gap-3 py-3 text-left transition-colors hover:bg-gold/[0.04]"
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                        <t.icon size={15} />
                      </span>
                      <span className="flex-1 text-sm font-medium group-hover:text-gold">{t.label}</span>
                      <ArrowRight size={14} className="shrink-0 text-muted group-hover:text-gold" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {active && (
              <div className="flex flex-col gap-4">
                <button
                  onClick={() => setActiveKey(null)}
                  className="flex w-fit items-center gap-1 text-xs text-muted hover:text-foreground"
                >
                  <ArrowLeft size={12} /> Back to topics
                </button>
                <div>
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                      <active.icon size={14} />
                    </span>
                    {active.label}
                  </p>
                  <p className="mt-2 text-sm text-muted">{active.answer}</p>
                </div>
                {(active.cta || active.secondaryCta) && (
                  <div className="flex flex-col gap-2">
                    {active.cta && (
                      <Link
                        href={active.cta.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-center gap-1.5 bg-gold px-4 py-2.5 text-sm font-semibold text-[#1A140A] hover:brightness-105"
                      >
                        {active.cta.label} <ArrowRight size={14} />
                      </Link>
                    )}
                    {active.secondaryCta && (
                      <Link
                        href={active.secondaryCta.href}
                        onClick={() => setOpen(false)}
                        className="flex items-center justify-center gap-1.5 border border-black/15 px-4 py-2.5 text-sm font-medium hover:border-gold"
                      >
                        {active.secondaryCta.label}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={toggle}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full text-black shadow-lg transition-transform hover:scale-105",
          "bg-gradient-to-br from-[var(--gold-light)] to-[var(--gold-dim)]"
        )}
        aria-label={open ? "Close guide" : "Open guide"}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}
