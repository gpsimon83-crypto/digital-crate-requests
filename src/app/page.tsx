import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { FloatingParticles } from "@/components/ui/floating-particles";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { Logo } from "@/components/site/logo";
import { MOCK_EVENT } from "@/lib/mock-data";
import { Smartphone, Zap, ShieldCheck, CalendarCheck } from "lucide-react";

const FEATURES = [
  { icon: Smartphone, title: "Easy for Guests", subtitle: "Simple, fast, and mobile-friendly" },
  { icon: Zap, title: "Powerful for DJs", subtitle: "Real-time dashboard and controls" },
  { icon: ShieldCheck, title: "Secure Payments", subtitle: "Powered by Stripe" },
  { icon: CalendarCheck, title: "Built for Events", subtitle: "Weddings, parties, and more" },
] as const;

const SECTIONS = [
  { label: "Book a DJ", href: "/book-a-dj" },
  { label: "Meet Our DJs", href: "/djs" },
  { label: "Client Portal", href: "/client-portal/wedding-anderson" },
  { label: "DJ Portal", href: `/dj-dashboard/${MOCK_EVENT.eventCode}` },
  { label: "Digital Crates", href: `/dj-dashboard/${MOCK_EVENT.eventCode}/crate-match` },
  { label: "Venues", href: "/venues" },
  { label: "Pricing", href: "/pricing" },
  { label: "Team Hub", href: "/team-hub" },
  { label: "Analytics", href: `/dj-dashboard/${MOCK_EVENT.eventCode}/analytics` },
  { label: "Admin", href: "/admin" },
] as const;

export default function Home() {
  return (
    <div className="relative min-h-dvh bg-background">
      <FloatingParticles />
      <div className="relative z-10">
        <SiteHeader />
        <main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-20">
          <header className="flex flex-col items-center gap-4 text-center">
            <Logo variant="full" color="gold" size={72} />
            <h1 className="max-w-2xl text-4xl font-extrabold leading-tight sm:text-5xl">
              Digital Crate Requests<sup className="text-lg">™</sup>
            </h1>
            <p className="max-w-md text-muted">Request. Tip. Vote. Connect.</p>
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <Link href={`/r/${MOCK_EVENT.eventCode}`}>
                <NeonButton color="cyan">Try Live Demo Event</NeonButton>
              </Link>
              <Link href="/book-a-dj">
                <NeonButton color="purple" variant="outline">Book a DJ</NeonButton>
              </Link>
            </div>
          </header>

          <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {SECTIONS.map((s) => (
              <Link key={s.label} href={s.href}>
                <GlassCard className="flex items-center justify-center py-6 text-center text-sm font-medium transition-colors hover:border-gold/40">
                  {s.label}
                </GlassCard>
              </Link>
            ))}
          </section>

          <section className="grid gap-4 sm:grid-cols-3">
            <GlassCard neon>
              <p className="mb-1 text-xs text-muted">Party Pulse™</p>
              <p className="text-2xl font-bold text-gold">Live Crowd Energy</p>
            </GlassCard>
            <GlassCard neon>
              <p className="mb-1 text-xs text-muted">Crowd Vote</p>
              <p className="text-2xl font-bold text-gold">Boost Your Song</p>
            </GlassCard>
            <GlassCard neon>
              <p className="mb-1 text-xs text-muted">Rewards</p>
              <p className="text-2xl font-bold text-gold">Earn &amp; Unlock</p>
            </GlassCard>
          </section>

          <section className="grid grid-cols-2 gap-6 border-t border-white/10 pt-12 sm:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title} className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold/40 text-gold">
                  <f.icon size={20} />
                </span>
                <p className="text-xs font-bold uppercase tracking-wide">{f.title}</p>
                <p className="text-xs text-muted">{f.subtitle}</p>
              </div>
            ))}
          </section>

          <p className="text-center text-xs text-muted">
            Crate Requests runs as an installable app inside DigitalCrateDJs.com —{" "}
            <Link href="/r" className="underline underline-offset-4">
              enter an event code
            </Link>{" "}
            to get started.
          </p>
        </main>
        <SiteFooter />
      </div>
    </div>
  );
}
