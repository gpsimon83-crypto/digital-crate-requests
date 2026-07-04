import { BottomNav } from "@/components/guest/bottom-nav";
import { FloatingParticles } from "@/components/ui/floating-particles";
import { Logo } from "@/components/site/logo";

export default function GuestLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-background">
      <FloatingParticles />
      <div className="relative z-10 mx-auto max-w-md pb-24">
        <div className="flex items-center justify-center gap-2 pt-5">
          <Logo variant="icon" color="gold" size={22} />
          <span className="text-xs font-bold uppercase tracking-[2px] text-foreground">
            Crate Requests
          </span>
        </div>
        {children}
      </div>
      <BottomNav />
    </div>
  );
}
