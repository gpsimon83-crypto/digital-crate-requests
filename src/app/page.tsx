import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Logo } from "@/components/site/logo";
import { BookingForm } from "@/components/site/booking-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { QrCode, Music2, Heart, LogIn, PartyPopper, UserCircle, Disc3, ExternalLink } from "lucide-react";

const STEPS = [
  { icon: QrCode, title: "Scan at your event", body: "Look for the Digital Crate QR code near the DJ booth — no app or account needed." },
  { icon: Music2, title: "Request & vote", body: "Browse the DJ's crate, request a song, and vote on what plays next." },
  { icon: Heart, title: "Tip your DJ", body: "Show love for a great set, right from your phone." }
];

const HELPER_PATHS = [
  {
    icon: PartyPopper,
    title: "Plan an Event",
    body: "Get a quote and book your date",
    href: "#booking"
  },
  {
    icon: UserCircle,
    title: "My Event Portal",
    body: "Already booked? Manage your night",
    href: "/portal/login"
  },
  {
    icon: Disc3,
    title: "DJ / Staff",
    body: "Team sign in",
    href: "/dj-dashboard/login"
  }
];

async function getDjs() {
  const db = createAdminClient();
  const { data } = await db.from("djs").select("id, display_name, photo_url").order("display_name");
  return data ?? [];
}

export default async function Home() {
  const djs = await getDjs();

  return (
    <div className="min-h-dvh bg-background">
      {/* NAV */}
      <nav className="sticky top-0 z-50 flex items-center justify-between border-b border-black/8 bg-background/90 px-6 py-4 backdrop-blur sm:px-10">
        <div className="flex items-center gap-2">
          <Logo variant="icon" brand="crates-djs" size={32} />
          <span className="text-sm font-semibold tracking-wide">Digital Crate DJs</span>
        </div>
        <div className="hidden items-center gap-6 text-xs font-medium uppercase tracking-widest text-muted sm:flex">
          <a href="#booking" className="hover:text-gold">Booking</a>
          <a href="#contact" className="hover:text-gold">Contact</a>
          <a
            href="https://digitalcratedjs.com"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 hover:text-gold"
          >
            About Us <ExternalLink size={11} />
          </a>
        </div>
        <Link href="/dj-dashboard/login" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gold">
          <LogIn size={14} /> DJ / Staff Login
        </Link>
      </nav>

      {/* HERO */}
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center sm:px-8">
        <Logo variant="full" brand="crates-djs" size={220} className="w-[320px] sm:w-[420px]" />
        <p className="-mt-2 text-xs font-semibold uppercase tracking-[0.3em] text-muted">Events Portal</p>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Wisconsin&rsquo;s Premier DJ Collective</p>

        <p
          className="fade-in-up mt-4 font-display text-4xl font-light text-foreground sm:text-5xl"
          style={{ animationDelay: "0.1s" }}
        >
          What brings you here today?
        </p>
        <div className="flex w-full flex-col divide-y divide-border border-y border-border sm:flex-row sm:divide-x sm:divide-y-0">
          {HELPER_PATHS.map((path, i) => (
            <Link
              key={path.title}
              href={path.href}
              style={{ animationDelay: `${0.25 + i * 0.12}s` }}
              className="fade-in-up group relative flex flex-1 flex-col items-center gap-2 px-5 py-8 text-center transition-colors hover:bg-gold/[0.04]"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/15 text-gold transition-transform group-hover:scale-110">
                <path.icon size={20} />
              </span>
              <p className="text-sm font-semibold group-hover:text-gold">{path.title}</p>
              <p className="text-xs text-muted">{path.body}</p>
              <span className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-gold transition-transform duration-300 group-hover:scale-x-100" />
            </Link>
          ))}
        </div>

        <div className="mt-8 grid w-full grid-cols-2 gap-6 border-t border-black/8 pt-8 sm:grid-cols-4">
          <Stat value="10+" label="Professional DJs" />
          <Stat value="WI" label="& Beyond" />
          <Stat value="All" label="Event Types" />
          <Stat value="24h" label="Response Time" />
        </div>
      </section>

      {/* HOW REQUESTS WORK */}
      <section className="border-t border-black/8 px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">At your event</p>
          <h2 className="mt-2 font-display text-5xl font-light">Request songs, live</h2>
          <div className="mt-8 flex flex-col divide-y divide-border border-y border-border sm:flex-row sm:divide-x sm:divide-y-0">
            {STEPS.map((step) => (
              <div
                key={step.title}
                className="group relative flex flex-1 flex-col items-center gap-2 px-5 py-8 text-center transition-colors hover:bg-gold/[0.04]"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/15 text-gold transition-transform group-hover:scale-110">
                  <step.icon size={20} />
                </span>
                <p className="text-sm font-semibold group-hover:text-gold">{step.title}</p>
                <p className="text-xs text-muted">{step.body}</p>
                <span className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-gold transition-transform duration-300 group-hover:scale-x-100" />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BOOKING */}
      <section id="booking" className="border-t border-black/8 px-6 py-16 sm:px-10">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Reserve your date</p>
            <h2 className="mt-2 font-display text-4xl font-light">Let&rsquo;s create something unforgettable together.</h2>
            <p className="mt-3 text-sm text-muted">
              Fill out the request form and a member of our team will respond within 24 hours to confirm availability and discuss the details of your event.
            </p>
            <ul className="mt-6 flex flex-col gap-3 text-xs text-muted">
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />24-hour response guarantee on all booking inquiries</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />Open-format DJs available for any event type or size</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />Serving the greater Wisconsin area and beyond</li>
              <li className="flex gap-2"><span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />Professional setup, sound, and MC services available</li>
            </ul>
          </div>
          <GlassCard neon>
            <BookingForm djs={djs} />
          </GlassCard>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="border-t border-black/8 px-6 py-16 sm:px-10">
        <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-2">
          <div>
            <h3 className="text-xl font-bold">We&rsquo;d love to hear from you.</h3>
            <dl className="mt-4 flex flex-col gap-3 text-sm">
              <ContactItem label="Location" value="Greater Wisconsin Area & Beyond" />
              <ContactItem label="Website" value="cratesdjs.com" />
              <ContactItem label="Response time" value="Within 24 hours" />
            </dl>
            <a
              href="https://www.facebook.com/538992336238186"
              target="_blank"
              rel="noreferrer"
              className="mt-4 flex h-11 w-11 items-center justify-center rounded-full border border-border text-sm font-bold text-muted hover:border-gold hover:text-gold"
            >
              f
            </a>
          </div>
          <div>
            <p className="text-xl font-medium italic text-muted">
              &ldquo;If music makes the event, <span className="text-gold not-italic">we add an experience.</span>&rdquo;
            </p>
            <p className="mt-4 text-sm text-muted">
              Ready to elevate your next event? Use our booking form above or reach out through our social channels. Digital Crate DJs is Wisconsin&rsquo;s premier open-format DJ collective — and we&rsquo;re ready to make your event unforgettable.
            </p>
            <a href="#booking" className="mt-4 inline-block text-sm font-semibold text-gold">Book a DJ Now &rarr;</a>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="flex flex-col items-center justify-between gap-3 border-t border-black/8 px-6 py-8 text-xs text-muted sm:flex-row sm:px-10">
        <div className="flex items-center gap-2">
          <Logo variant="icon" brand="wing" size={20} />
          <span>Digital Crate DJs</span>
        </div>
        <p>&copy; 2026 Digital Crate DJs. All rights reserved. &middot; cratesdjs.com</p>
      </footer>
    </div>
  );
}

function Stat({ value, label, boxed = false }: { value: string; label: string; boxed?: boolean }) {
  const content = (
    <>
      <strong className="block text-3xl font-bold text-gold">{value}</strong>
      <span className="mt-1 block text-[10px] uppercase tracking-widest text-muted">{label}</span>
    </>
  );
  if (boxed) {
    return <div className="rounded-[2px] border border-border bg-panel py-6 text-center">{content}</div>;
  }
  return <div className="text-center">{content}</div>;
}

function ContactItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-t border-black/8 pt-3 first:border-t-0 first:pt-0">
      <dt className="text-[10px] uppercase tracking-widest text-gold">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}
