import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_PAYMENTS } from "@/lib/mock-data";

const STATUS_CLASS: Record<string, string> = {
  authorized: "status-badge pending",
  captured: "status-badge approved",
  canceled: "status-badge declined",
};

const TYPE_LABEL: Record<string, string> = {
  tip: "Tip",
  request: "Paid Request",
  boost: "Boost",
};

export default function PaymentsPage() {
  const total = MOCK_PAYMENTS.filter((p) => p.status === "captured").reduce((sum, p) => sum + p.amountCents, 0);
  const pendingAuth = MOCK_PAYMENTS.filter((p) => p.status === "authorized").length;

  return (
    <>
      <PageHeader title="Payments" subtitle="Tips capture instantly. Paid requests authorize now, capture only when played." />
      <div className="flex flex-col gap-6 p-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <GlassCard>
            <p className="text-xs text-muted">Captured Tonight</p>
            <p className="text-2xl font-extrabold">${(total / 100).toFixed(2)}</p>
          </GlassCard>
          <GlassCard>
            <p className="text-xs text-muted">Pending Authorization</p>
            <p className="text-2xl font-extrabold">{pendingAuth}</p>
          </GlassCard>
        </div>

        <GlassCard className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-muted">
                <th className="pb-2 font-medium">Guest</th>
                <th className="pb-2 font-medium">Type</th>
                <th className="pb-2 font-medium">Song</th>
                <th className="pb-2 font-medium">Amount</th>
                <th className="pb-2 font-medium">Status</th>
                <th className="pb-2 font-medium">Time</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_PAYMENTS.map((p) => (
                <tr key={p.id} className="border-b border-white/5 last:border-0">
                  <td className="py-2.5">{p.guest}</td>
                  <td className="py-2.5 text-muted">{TYPE_LABEL[p.type]}</td>
                  <td className="py-2.5 text-muted">{"song" in p ? p.song : "—"}</td>
                  <td className="py-2.5 font-semibold">${(p.amountCents / 100).toFixed(2)}</td>
                  <td className="py-2.5">
                    <span className={STATUS_CLASS[p.status]}>{p.status}</span>
                  </td>
                  <td className="py-2.5 text-xs text-muted">{p.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      </div>
    </>
  );
}
