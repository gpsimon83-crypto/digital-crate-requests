import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_DJS } from "@/lib/mock-data";
import { Star } from "lucide-react";

export default function AdminDjsPage() {
  return (
    <>
      <PageHeader title="Manage DJs" subtitle="Add, edit, or remove DJs from the roster." />
      <div className="flex flex-col gap-3 p-6">
        <NeonButton color="gold" className="w-full sm:w-fit">+ Add DJ</NeonButton>
        {MOCK_DJS.map((dj) => (
          <GlassCard key={dj.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{dj.name}</p>
              <p className="text-xs text-muted">{dj.eventTypes.join(", ")}</p>
              <div className="mt-1 flex items-center gap-1 text-xs text-gold">
                <Star size={11} fill="currentColor" /> {dj.rating} ({dj.reviewCount})
              </div>
            </div>
            <div className="flex gap-2">
              <button className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-muted hover:text-foreground">
                Edit
              </button>
              <button className="rounded-full border border-status-declined/40 px-3 py-1.5 text-xs text-status-declined">
                Remove
              </button>
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}
