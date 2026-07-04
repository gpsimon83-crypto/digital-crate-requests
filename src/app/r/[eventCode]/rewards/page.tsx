import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { MOCK_REWARDS } from "@/lib/mock-data";
import { Star } from "lucide-react";

export default function RewardsPage() {
  return (
    <main className="flex flex-col gap-5 px-5 pt-10">
      <header className="flex flex-col items-center gap-2 text-center">
        <Star size={30} className="text-neon-gold" />
        <h1 className="text-xl font-bold">Rewards</h1>
        <p className="text-3xl font-extrabold text-neon-gold">{MOCK_REWARDS.points} pts</p>
      </header>

      <GlassCard>
        <p className="mb-2 text-sm font-semibold">Recent activity</p>
        <ul className="flex flex-col gap-2 text-sm">
          {MOCK_REWARDS.history.map((h) => (
            <li key={h.id} className="flex justify-between text-muted">
              <span>{h.action}</span>
              <span className="text-neon-lime">+{h.points}</span>
            </li>
          ))}
        </ul>
      </GlassCard>

      <div>
        <p className="mb-3 text-sm font-semibold">Unlock rewards</p>
        <div className="grid grid-cols-2 gap-3">
          {MOCK_REWARDS.unlockables.map((u) => {
            const canAfford = MOCK_REWARDS.points >= u.cost;
            return (
              <GlassCard key={u.id} className="flex flex-col items-center gap-2 text-center">
                <p className="text-sm font-medium">{u.label}</p>
                <p className="text-xs text-muted">{u.cost} pts</p>
                <NeonButton
                  color={canAfford ? "purple" : "cyan"}
                  variant={canAfford ? "solid" : "outline"}
                  disabled={!canAfford}
                  className="w-full px-3 py-2 text-xs"
                >
                  {canAfford ? "Redeem" : "Locked"}
                </NeonButton>
              </GlassCard>
            );
          })}
        </div>
      </div>
    </main>
  );
}
