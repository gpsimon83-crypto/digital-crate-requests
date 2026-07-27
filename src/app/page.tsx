import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { Logo } from "@/components/site/logo";
import { BookingForm } from "@/components/site/booking-form";
import { createAdminClient } from "@/lib/supabase/admin";
import { QrCode, Music2, Heart, LogIn } from "lucide-react";

const SERVICES = [
  { num: "01", title: "Clubs & Bars", body: "Resident and guest DJ sets that command the dance floor. We build momentum, sustain energy, and keep crowds coming back." },
  { num: "02", title: "Weddings", body: "From ceremony to last dance — personalized playlists, seamless transitions, and professional MC services tailored to your perfect day." },
  { num: "03", title: "Corporate Events", body: "Sophisticated entertainment for galas, launch parties, and company celebrations. We set the tone for every moment." },
  { num: "04", title: "Holiday Events", body: "Festive, curated sets that bring seasonal energy to your party — from holiday classics to crowd-favorite hits." },
  { num: "05", title: "Private Parties", body: "Birthdays, anniversaries, and private celebrations — fully customized music experiences built around your crowd and vibe." },
  { num: "06", title: "Open Format", body: "Hip-hop, R&B, Afrobeats, house, Latin, top 40 — our DJs move effortlessly across genres and blend them into one seamless journey." }
];

const STEPS = [
  { icon: QrCode, title: "Scan at your event", body: "Look for the Digital Crate QR code near the DJ booth — no app or account needed." },
  { icon: Music2, title: "Request & vote", body: "Browse the DJ's crate, request a song, and vote on what plays next." },
  { icon: Heart, title: "Tip your DJ", body: "Show love for a great set, right from your phone." }
];

const GOLD_BUTTON =
  "btn-glow btn-gold-solid inline-flex min-h-[50px] items-center justify-center gap-2 rounded-full px-7 py-3.5 text-sm font-bold tracking-wide text-black transition-colors";
const GOLD_BUTTON_STYLE = { background: "linear-gradient(155deg, var(--gold-light), var(--neon-gold) 55%)" };

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
          <Logo variant="icon" brand="wing" size={32} />
          <span className="text-sm font-semibold tracking-wide">Digital Crate DJs</span>
        </div>
        <div className="hidden gap-6 text-xs font-medium uppercase tracking-widest text-muted sm:flex">
          <a href="#about" className="hover:text-gold">About</a>
          <a href="#services" className="hover:text-gold">Services</a>
          <a href="#roster" className="hover:text-gold">Our DJs</a>
          <a href="#booking" className="hover:text-gold">Booking</a>
          <a href="#contact" className="hover:text-gold">Contact</a>
        </div>
        <Link href="/dj-dashboard/login" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-gold">
          <LogIn size={14} /> DJ / Staff Login
        </Link>
      </nav>

      {/* HERO */}
      <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-6 py-20 text-center sm:px-8">
        <Logo variant="full" brand="wing" size={200} className="w-[180px] sm:w-[220px]" />
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Wisconsin&rsquo;s Premier DJ Collective</p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">
          If music makes the event, <span className="text-gold">we add an experience.</span>
        </h1>
        <p className="max-w-md text-sm text-muted">
          Open-format DJs for clubs, weddings, corporate events & more — serving the greater Wisconsin area and beyond.
        </p>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          <a href="#booking" className={GOLD_BUTTON} style={GOLD_BUTTON_STYLE}>
            Book a DJ
          </a>
          <a href="#roster" className="inline-flex min-h-[50px] items-center justify-center rounded-full border-2 border-border px-7 text-sm font-bold tracking-wide hover:border-gold hover:text-gold">
            Meet the DJs
          </a>
        </div>
        <div className="mt-8 grid w-full grid-cols-2 gap-6 border-t border-black/8 pt-8 sm:grid-cols-4">
          <Stat value="10+" label="Professional DJs" />
          <Stat value="WI" label="& Beyond" />
          <Stat value="All" label="Event Types" />
          <Stat value="24h" label="Response Time" />
        </div>
      </section>

      {/* ABOUT */}
      <section id="about" className="border-t border-black/8 px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-4xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Who we are</p>
          <h2 className="mt-2 text-3xl font-bold">A collective built on music & experience</h2>
          <div className="mt-6 grid gap-10 sm:grid-cols-2">
            <div className="flex flex-col gap-4 text-sm leading-7 text-muted">
              <p>Digital Crate DJs is Wisconsin&rsquo;s premier DJ collective — a hand-picked roster of open-format artists who bring versatility, professionalism, and an undeniable energy to every event they touch.</p>
              <p>From intimate bar residencies to high-energy club nights, elegant weddings, and corporate galas — our DJs read the room, move the crowd, and create moments that last long after the music stops.</p>
              <p>We don&rsquo;t just play music. We craft experiences. And that makes all the difference.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Stat value="10+" label="DJs on roster" boxed />
              <Stat value="100%" label="Open format" boxed />
              <Stat value="WI+" label="Service area" boxed />
              <Stat value="Any" label="Event size" boxed />
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="border-t border-black/8 px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">What we offer</p>
          <h2 className="mt-2 text-3xl font-bold">DJ services for every occasion</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((s) => (
              <GlassCard key={s.num} className="flex flex-col gap-2">
                <span className="text-3xl font-bold text-border">{s.num}</span>
                <p className="font-semibold">{s.title}</p>
                <p className="text-sm text-muted">{s.body}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* ROSTER */}
      <section id="roster" className="border-t border-black/8 px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">The collective</p>
          <h2 className="mt-2 text-3xl font-bold">Meet the Digital Crate DJs</h2>
          <p className="mt-2 max-w-lg text-sm text-muted">
            Every DJ brings their own signature style — united by a shared standard of excellence.
          </p>
          <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
            {djs.length === 0 && <p className="text-sm text-muted">DJ roster coming soon.</p>}
            {djs.map((dj) => (
              <GlassCard key={dj.id} className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full border border-gold-dim text-lg font-semibold text-gold">
                  {dj.display_name.charAt(0)}
                </span>
                <p className="text-sm font-semibold">{dj.display_name}</p>
                <p className="text-[10px] uppercase tracking-widest text-muted">Open Format</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* HOW REQUESTS WORK */}
      <section className="border-t border-black/8 px-6 py-16 sm:px-10">
        <div className="mx-auto max-w-5xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">At your event</p>
          <h2 className="mt-2 text-3xl font-bold">Request songs, live</h2>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step) => (
              <GlassCard key={step.title} className="flex flex-col items-center gap-2 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <step.icon size={20} />
                </span>
                <p className="text-sm font-semibold">{step.title}</p>
                <p className="text-xs text-muted">{step.body}</p>
              </GlassCard>
            ))}
          </div>
        </div>
      </section>

      {/* BOOKING */}
      <section id="booking" className="border-t border-black/8 px-6 py-16 sm:px-10">
        <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-[1fr_2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold">Reserve your date</p>
            <h2 className="mt-2 text-2xl font-bold leading-snug">Let&rsquo;s create something unforgettable together.</h2>
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
    return <div className="rounded-xl border border-border bg-panel py-6 text-center">{content}</div>;
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
