import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_VENUES } from "@/lib/mock-data";
import { MapPin } from "lucide-react";

export default function AdminVenuesPage() {
  return (
    <>
      <PageHeader title="Manage Venues" subtitle="Add, edit, or remove venue partners." />
      <div className="flex flex-col gap-3 p-6">
        <NeonButton color="gold" className="w-full sm:w-fit">+ Add Venue</NeonButton>
        {MOCK_VENUES.map((v) => (
          <GlassCard key={v.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{v.name}</p>
              <p className="flex items-center gap-1 text-xs text-muted">
                <MapPin size={11} /> {v.location}
              </p>
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
