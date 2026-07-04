import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { Mail, Phone, MapPin } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold">Contact Us</h1>
          <p className="mt-2 text-muted">Questions about booking, Crate Requests, or an event you&apos;re planning?</p>
        </header>

        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          <GlassCard className="flex flex-col items-center gap-1 text-center text-sm">
            <Mail size={18} className="text-neon-cyan" />
            <span>gpsimon83@yahoo.com</span>
          </GlassCard>
          <GlassCard className="flex flex-col items-center gap-1 text-center text-sm">
            <Phone size={18} className="text-neon-pink" />
            <span>(555) 555-0100</span>
          </GlassCard>
          <GlassCard className="flex flex-col items-center gap-1 text-center text-sm">
            <MapPin size={18} className="text-neon-lime" />
            <span>Southeastern Wisconsin</span>
          </GlassCard>
        </div>

        <GlassCard neon>
          <form className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name" placeholder="Your name" />
              <Field label="Email" placeholder="you@email.com" type="email" />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Message</span>
              <textarea
                rows={5}
                placeholder="How can we help?"
                className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm placeholder:text-muted/60 focus:border-neon-cyan focus:outline-none"
              />
            </label>
            <NeonButton type="submit" color="cyan" className="w-full">
              Send Message
            </NeonButton>
          </form>
        </GlassCard>
      </main>
      <SiteFooter />
    </div>
  );
}

function Field({ label, placeholder, type = "text" }: { label: string; placeholder?: string; type?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm placeholder:text-muted/60 focus:border-neon-cyan focus:outline-none"
      />
    </label>
  );
}
