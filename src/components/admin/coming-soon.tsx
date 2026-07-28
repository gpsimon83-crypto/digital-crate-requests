import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import type { LucideIcon } from "lucide-react";

export function AdminComingSoon({
  title,
  subtitle,
  icon: Icon,
  body
}: {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  body: string;
}) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="p-6">
        <GlassCard className="flex flex-col items-start gap-3 py-12 text-left sm:items-center sm:text-center">
          <Icon size={28} className="text-gold" />
          <p className="font-display text-2xl font-light">Coming soon</p>
          <p className="max-w-md text-sm text-muted">{body}</p>
        </GlassCard>
      </div>
    </>
  );
}
