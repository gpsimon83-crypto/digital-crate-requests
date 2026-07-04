import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter } from "@/components/site/site-footer";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";

export default function BookADjPage() {
  return (
    <div className="min-h-dvh bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-16">
        <header className="mb-10 text-center">
          <h1 className="text-3xl font-extrabold">Book a Digital Crate DJ</h1>
          <p className="mt-2 text-muted">
            Tell us about your event and we&apos;ll match you with the right DJ, package, and Crate Requests setup.
          </p>
        </header>

        <GlassCard neon>
          <form className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" placeholder="Jordan Smith" />
              <Field label="Email" placeholder="you@email.com" type="email" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone" placeholder="(555) 555-0100" type="tel" />
              <Field label="Event Date" type="date" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Event Type" options={["Wedding", "Corporate", "Private Party", "Club Night"]} />
              <Field label="Estimated Guest Count" placeholder="150" type="number" />
            </div>
            <label className="block">
              <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Tell us more</span>
              <textarea
                rows={4}
                placeholder="Venue, vibe, must-play songs, anything else..."
                className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm placeholder:text-muted/60 focus:border-neon-cyan focus:outline-none"
              />
            </label>
            <NeonButton type="submit" color="cyan" className="mt-2 w-full">
              Request a Quote
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

function SelectField({ label, options }: { label: string; options: string[] }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <select className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm focus:border-neon-cyan focus:outline-none">
        {options.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </label>
  );
}
