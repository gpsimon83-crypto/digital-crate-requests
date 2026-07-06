import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { FloatingParticles } from "@/components/ui/floating-particles";
import { Logo } from "@/components/site/logo";

export default function EnterEventPage() {
  return (
    <div className="relative min-h-dvh bg-background">
      <FloatingParticles />
      <main className="relative z-10 mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6">
        <header className="flex flex-col items-center gap-3 text-center">
          <Logo variant="full" color="white" size={64} />
          <p className="text-xs uppercase tracking-[3px] text-muted">Powered by Digital Crate DJs</p>
          <h1 className="text-2xl font-bold">Request. Tip. Enjoy.</h1>
        </header>

        <GlassCard className="flex flex-col gap-4">
          <p className="text-center text-xs text-muted">
            Scanned a QR code at your event? It should have opened your event page directly.
            Otherwise, enter the event code below.
          </p>
          <div className="h-px bg-white/10" />
          <form action="/r" className="flex flex-col gap-3">
            <input
              name="code"
              placeholder="Enter event code"
              className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-center text-sm tracking-widest placeholder:text-muted/60 focus:border-gold focus:outline-none"
            />
            <NeonButton type="submit" color="cyan" className="w-full">
              Join Event
            </NeonButton>
          </form>
        </GlassCard>
      </main>
    </div>
  );
}
