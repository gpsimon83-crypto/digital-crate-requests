import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_FEED } from "@/lib/mock-data";
import { Music4, Heart, Zap, PlayCircle, Megaphone, Flame } from "lucide-react";

const TYPE_META: Record<string, { icon: typeof Music4; color: string }> = {
  request: { icon: Music4, color: "text-gold" },
  tip: { icon: Heart, color: "text-status-declined" },
  boost: { icon: Zap, color: "text-status-pending" },
  played: { icon: PlayCircle, color: "text-status-approved" },
  announcement: { icon: Megaphone, color: "text-status-played" },
  crowd_favorite: { icon: Flame, color: "text-gold" },
};

export default function LivePartyFeedPage() {
  return (
    <>
      <PageHeader title="Live Party Feed" subtitle="Everything happening at your event, in real time." />
      <div className="flex flex-col gap-3 p-6">
        {MOCK_FEED.map((f) => {
          const meta = TYPE_META[f.type] ?? TYPE_META.request;
          const Icon = meta.icon;
          return (
            <GlassCard key={f.id} className="flex items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/5 ${meta.color}`}>
                <Icon size={16} />
              </span>
              <p className="flex-1 text-sm text-muted">{f.text}</p>
              <span className="shrink-0 text-[11px] text-muted/70">{f.time}</span>
            </GlassCard>
          );
        })}
      </div>
    </>
  );
}
