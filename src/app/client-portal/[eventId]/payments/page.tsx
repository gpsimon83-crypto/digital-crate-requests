import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_CLIENT_PAYMENTS } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

export default function ClientPaymentsPage() {
  return (
    <>
      <PageHeader title="Payments" subtitle="Your booking deposit and balance schedule." />
      <div className="flex flex-col gap-3 p-6">
        {MOCK_CLIENT_PAYMENTS.map((p) => (
          <GlassCard key={p.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{p.label}</p>
              <p className="text-xs text-muted">Due {p.due}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-bold">${(p.amountCents / 100).toFixed(2)}</span>
              <span
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] capitalize",
                  p.status === "paid" ? "text-neon-lime border-neon-lime/40" : "text-neon-gold border-neon-gold/40"
                )}
              >
                {p.status}
              </span>
              {p.status === "due" && (
                <NeonButton color="cyan" className="px-3 py-2 text-xs">Pay Now</NeonButton>
              )}
            </div>
          </GlassCard>
        ))}
      </div>
    </>
  );
}
