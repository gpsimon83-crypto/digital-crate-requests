import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_CLIENT_EVENT } from "@/lib/mock-data";

export default function ClientEventDetailsPage() {
  const e = MOCK_CLIENT_EVENT;
  return (
    <>
      <PageHeader title={`${e.eventType} — ${e.clientName}`} subtitle="Everything about your event in one place." />
      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Field label="Date" value={e.date} />
          <Field label="Venue" value={e.venue} />
          <Field label="DJ" value={e.dj} />
          <Field label="Guest Count" value={String(e.guestCount)} />
        </div>

        <GlassCard neon className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted">Booking Status</p>
            <p className="text-xl font-bold text-neon-lime">{e.status}</p>
          </div>
        </GlassCard>
      </div>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <GlassCard>
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </GlassCard>
  );
}
