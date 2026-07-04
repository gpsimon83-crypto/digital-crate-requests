import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_TIMELINE } from "@/lib/mock-data";

export default function TimelinePage() {
  return (
    <>
      <PageHeader title="Event Timeline" subtitle="The run-of-show your DJ will follow." />
      <div className="flex flex-col gap-3 p-6">
        {MOCK_TIMELINE.map((t) => (
          <GlassCard key={t.id} className="flex items-center gap-4">
            <span className="w-20 shrink-0 text-sm font-mono text-neon-cyan">{t.time}</span>
            <span className="text-sm">{t.label}</span>
          </GlassCard>
        ))}
      </div>
    </>
  );
}
