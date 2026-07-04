import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader title="Platform Settings" subtitle="Global configuration for Digital Crate Requests." />
      <div className="flex flex-col gap-4 p-6">
        <GlassCard className="flex flex-col gap-4">
          <ToggleRow label="Allow new DJ self-registration with invite code" checked />
          <ToggleRow label="Require disclaimer acceptance before paid requests" checked />
          <ToggleRow label="Enable Crowd Vote boosts platform-wide" checked />
          <ToggleRow label="Enable push notifications" checked={false} />
        </GlassCard>
        <NeonButton color="gold" className="w-full sm:w-fit">Save Settings</NeonButton>
      </div>
    </>
  );
}

function ToggleRow({ label, checked }: { label: string; checked: boolean }) {
  return (
    <label className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <span className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-gold" : "bg-white/10"}`}>
        <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`} />
      </span>
    </label>
  );
}
