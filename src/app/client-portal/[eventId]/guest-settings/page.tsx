import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_EVENT_SETTINGS } from "@/lib/mock-data";

export default function GuestSettingsPage() {
  return (
    <>
      <PageHeader title="Guest Request Settings" subtitle="Control how your guests can interact during the event." />
      <div className="flex flex-col gap-4 p-6">
        <GlassCard className="flex flex-col gap-4">
          <ToggleRow label="Allow guests to request songs" checked={MOCK_EVENT_SETTINGS.guestRequestsEnabled} />
          <ToggleRow label="Allow paid boosts on requests" checked={MOCK_EVENT_SETTINGS.boostsEnabled} />
          <ToggleRow label="Allow explicit songs" checked={MOCK_EVENT_SETTINGS.explicitAllowed} />
        </GlassCard>
        <NeonButton color="cyan" className="w-full sm:w-fit">Save Settings</NeonButton>
      </div>
    </>
  );
}

function ToggleRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <label className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-neon-cyan" : "bg-white/10"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </span>
    </label>
  );
}
