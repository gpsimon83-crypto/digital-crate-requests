import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { LifeBuoy, ExternalLink, Music } from "lucide-react";

const LINKS = [
  {
    href: "https://digitalcratedjs.com/members",
    label: "DJ Portal",
    description: "The music-library and live-event tools your DJs use on gig day.",
    icon: Music
  }
];

export default function AdminResourcesPage() {
  return (
    <>
      <PageHeader title="Resources" subtitle="Help and reference links." />
      <div className="flex flex-col gap-6 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {LINKS.map(({ href, label, description, icon: Icon }) => (
            <a key={href} href={href} target="_blank" rel="noreferrer">
              <GlassCard className="flex items-start gap-3 transition-colors hover:border-gold/40">
                <Icon size={20} className="mt-0.5 shrink-0 text-gold" />
                <div className="flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    {label} <ExternalLink size={12} className="text-muted" />
                  </p>
                  <p className="text-xs text-muted">{description}</p>
                </div>
              </GlassCard>
            </a>
          ))}
        </div>

        <GlassCard className="flex items-start gap-3">
          <LifeBuoy size={20} className="mt-0.5 shrink-0 text-gold" />
          <div>
            <p className="text-sm font-semibold">Need something else?</p>
            <p className="text-xs text-muted">
              Support tooling like guided help and a knowledge base isn&apos;t built yet — for now, reach out to
              whoever manages this platform directly.
            </p>
          </div>
        </GlassCard>
      </div>
    </>
  );
}
