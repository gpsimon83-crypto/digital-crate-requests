"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { KeyRound } from "lucide-react";

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
      <PageHeader
        title="Invite Codes"
        subtitle="One-time codes for new DJs to register into the platform."
        action={
          <Button variant="primary" onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating…" : "Generate Code"}
          </Button>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        {error && <p className="text-xs text-status-declined">{error}</p>}

        {codes === null && <p className="text-sm text-muted">Loading…</p>}
        {codes?.length === 0 && <EmptyState icon={KeyRound} title="No invite codes yet" body="Generate one to invite a new DJ." />}
        {codes && codes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Assigned DJ</th>
                  <th>Status</th>
                  <th className="sr-only">Actions</th>
                </tr>
              </thead>
              <tbody>
                {codes.map((c) => (
                  <tr key={c.id}>
                    <td className="font-mono font-medium">{c.code}</td>
                    <td className="text-muted">{c.djs?.display_name ?? "Unassigned"}</td>
                    <td>
                      <span className={`status-dot ${c.used ? "declined" : "approved"}`}>{c.used ? "Used" : "Available"}</span>
                    </td>
                    <td>
                      <button onClick={() => handleDelete(c.id)} className="text-xs text-muted hover:text-status-declined">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
