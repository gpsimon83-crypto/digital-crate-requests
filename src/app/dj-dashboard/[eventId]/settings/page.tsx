import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_EVENT_SETTINGS } from "@/lib/mock-data";

export default function EventSettingsPage() {
  return (
    <>
      <PageHeader title="Event Settings" subtitle="Control what guests can request and how requests are handled." />
      <div className="flex flex-col gap-6 p-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <GlassCard>
            <p className="mb-3 text-sm font-semibold text-neon-lime">Must-Play List</p>
            <ul className="flex flex-col gap-2 text-sm text-muted">
              {MOCK_EVENT_SETTINGS.mustPlay.map((s) => (
                <li key={s} className="rounded-lg border border-white/10 bg-panel px-3 py-2">{s}</li>
              ))}
            </ul>
          </GlassCard>

          <GlassCard>
            <p className="mb-3 text-sm font-semibold text-neon-pink">Do-Not-Play List</p>
            <ul className="flex flex-col gap-2 text-sm text-muted">
              {MOCK_EVENT_SETTINGS.doNotPlay.map((s) => (
                <li key={s} className="rounded-lg border border-white/10 bg-panel px-3 py-2">{s}</li>
              ))}
            </ul>
          </GlassCard>
        </div>

        <GlassCard className="flex flex-col gap-4">
          <p className="text-sm font-semibold">Guest Request Settings</p>
          <ToggleRow label="Guest requests enabled" checked={MOCK_EVENT_SETTINGS.guestRequestsEnabled} />
          <ToggleRow label="Boosts enabled" checked={MOCK_EVENT_SETTINGS.boostsEnabled} />
          <ToggleRow label="Allow explicit songs" checked={MOCK_EVENT_SETTINGS.explicitAllowed} />
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
              Max paid request price
            </span>
            <input
              type="number"
              defaultValue={MOCK_EVENT_SETTINGS.maxRequestPriceCents / 100}
              className="w-40 rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm focus:border-neon-cyan focus:outline-none"
            />
          </label>
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
      <span
        className={`relative h-6 w-11 rounded-full transition-colors ${checked ? "bg-neon-cyan" : "bg-white/10"}`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-black transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
        />
      </span>
    </label>
  );
}
