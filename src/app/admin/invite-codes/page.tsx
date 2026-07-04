import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_INVITE_CODES } from "@/lib/mock-data";

export default function InviteCodesPage() {
  return (
    <>
      <PageHeader title="DJ Invite Codes" subtitle="One-time codes for new DJs to register into the platform." />
      <div className="flex flex-col gap-3 p-6">
        <NeonButton color="gold" className="w-full sm:w-fit">+ Generate Code</NeonButton>
        {MOCK_INVITE_CODES.map((c) => (
          <GlassCard key={c.id} className="flex items-center justify-between">
            <div>
              <p className="font-mono font-semibold">{c.code}</p>
              <p className="text-xs text-muted">{c.assignedTo}</p>
            </div>
            <span className={c.used ? "status-badge declined" : "status-badge approved"}>
              {c.used ? "Used" : "Available"}
            </span>
          </GlassCard>
        ))}
      </div>
    </>
  );
}
