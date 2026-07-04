import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";

export default async function LoginPage({
  params,
}: {
  params: Promise<{ eventCode: string }>;
}) {
  const { eventCode } = await params;

  return (
    <main className="flex flex-col gap-6 px-5 pt-10">
      <header className="text-center">
        <h1 className="text-xl font-bold">Create Your Profile</h1>
        <p className="mt-1 text-sm text-muted">
          Save your requests, tips, and rewards across every Digital Crate DJs event.
        </p>
      </header>

      <GlassCard className="flex flex-col gap-4">
        <form className="flex flex-col gap-3" action={`/r/${eventCode}`} method="get">
          <Field label="Full Name" type="text" placeholder="Jordan Smith" />
          <Field label="Phone Number" type="tel" placeholder="(555) 555-0100" />
          <Field label="Email" type="email" placeholder="you@email.com" />
          <Field label="Birthday (optional)" type="date" />

          <div>
            <label className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
              Favorite Genres
            </label>
            <div className="flex flex-wrap gap-2">
              {["Hip-Hop", "Pop", "House", "R&B", "Latin", "Country"].map((g) => (
                <span
                  key={g}
                  className="rounded-full border border-white/10 bg-panel px-3 py-1.5 text-xs text-muted"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 text-xs text-muted">
            <input type="checkbox" className="mt-0.5 accent-[var(--neon-cyan)]" />
            Send me updates about future Digital Crate DJs events and offers.
          </label>

          <NeonButton type="submit" color="cyan" className="mt-2 w-full">
            Continue
          </NeonButton>
        </form>
      </GlassCard>
    </main>
  );
}

function Field({
  label,
  type,
  placeholder,
}: {
  label: string;
  type: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm text-foreground placeholder:text-muted/60 focus:border-neon-cyan focus:outline-none"
      />
    </label>
  );
}
