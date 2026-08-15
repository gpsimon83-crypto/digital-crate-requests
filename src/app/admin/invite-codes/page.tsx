"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
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

        <DataTable
          columns={columns(handleDelete)}
          rows={codes ?? []}
          rowKey={(c) => c.id}
          loading={codes === null}
          emptyIcon={KeyRound}
          emptyTitle="No invite codes yet"
          emptyBody="Generate one to invite a new DJ."
        />
      </div>
    </>
  );
}

function columns(onDelete: (id: string) => void): DataTableColumn<InviteCodeRow>[] {
  return [
    { key: "code", header: "Code", sortValue: (c) => c.code, render: (c) => <span className="font-mono font-medium">{c.code}</span> },
    {
      key: "dj",
      header: "Assigned DJ",
      sortValue: (c) => c.djs?.display_name ?? "",
      render: (c) => <span className="text-muted">{c.djs?.display_name ?? "Unassigned"}</span>
    },
    {
      key: "status",
      header: "Status",
      sortValue: (c) => (c.used ? 1 : 0),
      render: (c) => (
        <StatusChip tone={c.used ? "declined" : "approved"} variant="dot">
          {c.used ? "Used" : "Available"}
        </StatusChip>
      )
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (c) => (
        <button onClick={() => onDelete(c.id)} className="text-xs text-muted hover:text-status-declined">
          Delete
        </button>
      )
    }
  ];
}
