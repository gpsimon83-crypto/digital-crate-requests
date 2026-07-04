import { GlassCard } from "@/components/ui/glass-card";
import { MOCK_REQUESTS } from "@/lib/mock-data";

const STATUS_CLASS: Record<string, string> = {
  pending: "status-badge pending",
  approved: "status-badge approved",
  played: "status-badge played",
  declined: "status-badge declined",
};

export default function MyRequestsPage() {
  return (
    <main className="flex flex-col gap-5 px-5 pt-10">
      <header>
        <h1 className="text-xl font-bold">My Requests</h1>
        <p className="mt-1 text-sm text-muted">Track the status of everything you&apos;ve sent tonight.</p>
      </header>

      <div className="flex flex-col gap-3">
        {MOCK_REQUESTS.map((r) => (
          <GlassCard key={r.id} className="flex items-center justify-between">
            <div className="min-w-0">
              <p className="truncate font-semibold">{r.songTitle}</p>
              <p className="truncate text-xs text-muted">{r.artist}</p>
            </div>
            <span className={STATUS_CLASS[r.status]}>{r.status}</span>
          </GlassCard>
        ))}
      </div>
    </main>
  );
}
