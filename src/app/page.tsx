import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Logo } from "@/components/site/logo";
import { QrCode, Music2, Heart, LogIn } from "lucide-react";

const STEPS = [
  {
    icon: QrCode,
    title: "Scan at your event",
    body: "Look for the Digital Crate QR code near the DJ booth — no app or account needed.",
  },
  {
    icon: Music2,
    title: "Request & vote",
    body: "Browse the DJ's crate, request a song, and vote on what plays next.",
  },
  {
    icon: Heart,
    title: "Tip your DJ",
    body: "Show love for a great set, right from your phone.",
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex max-w-3xl flex-col items-center gap-10 px-6 py-16 text-center sm:px-8">
        <div className="hero-surface flex w-full flex-col items-center gap-4 px-6 py-14 sm:px-10">
          <span className="glow-ring">
            <Logo variant="full" color="gold" size={64} />
          </span>
          <h1 className="max-w-xl text-3xl font-extrabold leading-tight sm:text-4xl">
            Digital Crate Requests<sup className="text-lg">™</sup>
          </h1>
          <p className="gold-text-gradient text-sm font-semibold uppercase tracking-[3px]">
            Request. Tip. Vote. Connect.
          </p>
          <p className="max-w-md text-sm text-muted">
            At your Digital Crate DJs event, scan the QR code on display to request songs, tip your DJ, and vote
            on what plays next — straight from your phone.
          </p>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-3">
          {STEPS.map((step) => (
            <GlassCard key={step.title} className="flex flex-col items-center gap-2 !p-5 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/15 text-gold">
                <step.icon size={20} />
              </span>
              <p className="text-sm font-semibold">{step.title}</p>
              <p className="text-xs text-muted">{step.body}</p>
            </GlassCard>
          ))}
        </div>

        <div className="flex w-full flex-col items-center gap-3 border-t border-white/8 pt-8">
          <p className="text-xs text-muted">Are you a Digital Crate DJ or staff member?</p>
          <Link
            href="/dj-dashboard/login"
            className="btn-glow btn-gold-solid inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold tracking-wide text-black transition-colors"
            style={{ background: "linear-gradient(155deg, var(--gold-light), var(--neon-gold) 55%)" }}
          >
            <LogIn size={16} /> DJ / Staff Login
          </Link>
        </div>
      </main>
    </div>
  );
}
