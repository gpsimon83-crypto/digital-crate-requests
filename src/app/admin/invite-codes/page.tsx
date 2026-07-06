"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";

interface InviteCodeRow {
  id: string;
  code: string;
  used: boolean;
  djs: { display_name: string } | null;
}

export default function InviteCodesPage() {
  const [codes, setCodes] = useState<InviteCodeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/invite-codes");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load invite codes");
      setCodes(data.codes ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/invite-codes", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate code");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this invite code?")) return;
    try {
      const res = await fetch(`/api/admin/invite-codes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete code");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <>
      <PageHeader title="DJ Invite Codes" subtitle="One-time codes for new DJs to register into the platform." />
      <div className="flex flex-col gap-6 p-6">
        <NeonButton color="gold" onClick={handleGenerate} disabled={generating} className="w-full sm:w-fit">
          {generating ? "Generating..." : "+ Generate Code"}
        </NeonButton>

        {error && <p className="text-xs text-status-declined">{error}</p>}

        <div className="flex flex-col gap-3">
          {codes === null && <p className="text-sm text-muted">Loading...</p>}
          {codes?.length === 0 && <p className="text-sm text-muted">No invite codes yet.</p>}
          {codes?.map((c) => (
            <GlassCard key={c.id} className="flex items-center justify-between">
              <div>
                <p className="font-mono font-semibold">{c.code}</p>
                <p className="text-xs text-muted">{c.djs?.display_name ?? "Unassigned"}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className={c.used ? "status-badge declined" : "status-badge approved"}>
                  {c.used ? "Used" : "Available"}
                </span>
                <button
                  onClick={() => handleDelete(c.id)}
                  className="rounded-full border border-white/15 px-3 py-1.5 text-xs text-muted hover:text-foreground"
                >
                  Delete
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </>
  );
}
