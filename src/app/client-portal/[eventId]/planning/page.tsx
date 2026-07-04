import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";

export default function PlanningFormsPage() {
  return (
    <>
      <PageHeader title="Planning Forms" subtitle="Help your DJ prepare the perfect event." />
      <div className="flex flex-col gap-5 p-6">
        <GlassCard className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Special Moments</p>
          <FormField label="First dance song" placeholder="Song title — Artist" />
          <FormField label="Parent dance song" placeholder="Song title — Artist" />
          <FormField label="Entrance song" placeholder="Song title — Artist" />
        </GlassCard>

        <GlassCard className="flex flex-col gap-3">
          <p className="text-sm font-semibold">Notes for Your DJ</p>
          <label className="block">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">
              Anything else we should know?
            </span>
            <textarea
              rows={4}
              placeholder="Special announcements, dietary notes for the DJ, parking instructions, etc."
              className="w-full rounded-xl border border-white/10 bg-panel px-4 py-3 text-sm placeholder:text-muted/60 focus:border-neon-cyan focus:outline-none"
            />
          </label>
        </GlassCard>

        <NeonButton color="cyan" className="w-full sm:w-fit">Save Form</NeonButton>
      </div>
    </>
  );
}

function FormField({ label, placeholder }: { label: string; placeholder: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        placeholder={placeholder}
        className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm placeholder:text-muted/60 focus:border-neon-cyan focus:outline-none"
      />
    </label>
  );
}
