import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_CONTRACTS } from "@/lib/mock-data";
import { FileText } from "lucide-react";

export default function ContractsPage() {
  return (
    <>
      <PageHeader title="Contracts" subtitle="Review and sign documents for your event." />
      <div className="flex flex-col gap-3 p-6">
        {MOCK_CONTRACTS.map((doc) => (
          <GlassCard key={doc.id} className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileText size={20} className="text-neon-purple" />
              <div>
                <p className="font-medium">{doc.name}</p>
                <p className="text-xs text-muted">{doc.date !== "—" ? `Signed ${doc.date}` : "Not yet signed"}</p>
              </div>
            </div>
            {doc.status === "Signed" ? (
              <span className="rounded-full border border-neon-lime/40 px-3 py-1 text-[11px] text-neon-lime">Signed</span>
            ) : (
              <NeonButton color="gold" className="px-3 py-2 text-xs">Review &amp; Sign</NeonButton>
            )}
          </GlassCard>
        ))}
      </div>
    </>
  );
}
