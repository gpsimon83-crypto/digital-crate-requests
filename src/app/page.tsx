import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Logo } from "@/components/site/logo";
import {
  ListMusic,
  BarChart3,
  ShieldCheck,
  CalendarClock,
  Users,
  MapPin,
  DollarSign,
  Ticket,
  Settings,
  ArrowRight,
} from "lucide-react";

interface SiteLink {
  label: string;
  href: string;
  icon: typeof ListMusic;
}

interface SiteSection {
  label: string;
  href: string;
  icon: typeof ListMusic;
  description: string;
  links: SiteLink[];
}

const SECTIONS: SiteSection[] = [
  {
    label: "DJ Portal",
    href: "/dj-dashboard/bookings",
    icon: ListMusic,
    description: "Your bookings, live requests, and event controls.",
    links: [
      { label: "My / All Bookings", href: "/dj-dashboard/bookings", icon: CalendarClock },
    ],
  },
  {
    label: "Analytics",
    href: "/analytics",
    icon: BarChart3,
    description: "Revenue, requests, and performance across every event.",
    links: [{ label: "Analytics Dashboard", href: "/analytics", icon: BarChart3 }],
  },
  {
    label: "Admin",
    href: "/admin",
    icon: ShieldCheck,
    description: "Full platform control — events, roster, pricing, and settings.",
    links: [
      { label: "Dashboard", href: "/admin", icon: ShieldCheck },
      { label: "Events", href: "/admin/events", icon: CalendarClock },
      { label: "DJs", href: "/admin/djs", icon: Users },
      { label: "Venues", href: "/admin/venues", icon: MapPin },
      { label: "Monetization", href: "/admin/monetization", icon: DollarSign },
      { label: "Invite Codes", href: "/admin/invite-codes", icon: Ticket },
      { label: "Settings", href: "/admin/settings", icon: Settings },
    ],
  },
];

export default function Home() {
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12 sm:px-8">
        <div className="hero-surface flex flex-col items-center gap-4 px-6 py-14 text-center sm:px-10">
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
            The operations platform behind every Digital Crate DJs event — sign in to manage your bookings,
            track performance, or run the whole show.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {SECTIONS.map((section) => (
            <GlassCard key={section.label} className="flex flex-col gap-4 !p-5 sm:!p-6">
              <Link href={section.href} className="group flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <section.icon size={20} />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-bold">
                    {section.label}
                    <ArrowRight size={14} className="text-muted transition-transform group-hover:translate-x-0.5" />
                  </p>
                  <p className="text-xs text-muted">{section.description}</p>
                </div>
              </Link>

              <ul className="flex flex-col gap-1 border-t border-white/8 pt-3">
                {section.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-muted transition-colors hover:bg-white/5 hover:text-foreground"
                    >
                      <link.icon size={14} className="shrink-0 text-gold/70" />
                      <span className="truncate">{link.label}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>

        <p className="text-center text-xs text-muted">
          Sign in required for all sections. Once inside an event, use the sidebar to reach Live Queue, Live
          Feed, Party Pulse, Payments, Guest CRM, and Settings.
        </p>
      </main>
    </div>
  );
}
