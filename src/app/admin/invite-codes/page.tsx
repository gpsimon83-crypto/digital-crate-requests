"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { StatusChip } from "@/components/ui/status-chip";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { Check, Copy, KeyRound, Mail, MessageSquare } from "lucide-react";

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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  async function copyInvite(c: InviteCodeRow) {
    try {
      await navigator.clipboard.writeText(inviteMessage(c.code));
      setCopied(c.id);
      setTimeout(() => setCopied((v) => (v === c.id ? null : v)), 2000);
    } catch {
      setError("Couldn't copy. Select the code and copy it by hand.");
    }
  }

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
    try {
      const res = await fetch(`/api/admin/invite-codes/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete code");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPendingDeleteId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Invite Codes"
        subtitle="One-time codes for new DJs to register. Generate a code, then use Copy, Email or Text on its row to send the DJ a sign-up link with the code already filled in."
        action={
          <Button variant="primary" onClick={handleGenerate} disabled={generating}>
            {generating ? "Generating…" : "Generate Code"}
          </Button>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        {error && <p className="text-xs text-status-declined">{error}</p>}

        <DataTable
          columns={columns(setPendingDeleteId, copied, copyInvite)}
          rows={codes ?? []}
          rowKey={(c) => c.id}
          loading={codes === null}
          emptyIcon={KeyRound}
          emptyTitle="No invite codes yet"
          emptyBody="Generate one to invite a new DJ."
        />
      </div>

      <ConfirmModal
        open={!!pendingDeleteId}
        title="Delete this invite code?"
        confirmLabel="Delete"
        onConfirm={() => pendingDeleteId && handleDelete(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}

/** Sign-up link with the code filled in, on this site. */
function signupLink(code: string) {
  const origin = typeof window !== "undefined" ? window.location.origin : "https://cratesdjs.com";
  return `${origin}/dj-dashboard/signup?code=${encodeURIComponent(code)}`;
}

function inviteMessage(code: string) {
  return `You're invited to join Digital Crate DJs! Create your DJ account here: ${signupLink(code)}\n\nYour invite code is ${code} (it's already filled in on that page). It works once.`;
}

const sendBtn = "inline-flex items-center gap-1 rounded-[8px] border border-border px-2 py-1 text-xs font-medium hover:border-gold";

function columns(onDelete: (id: string) => void, copied: string | null, onCopy: (c: InviteCodeRow) => void): DataTableColumn<InviteCodeRow>[] {
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
      key: "send",
      header: "Send to a DJ",
      render: (c) =>
        c.used ? (
          <span className="text-xs text-muted">Already used</span>
        ) : (
          <div className="flex flex-wrap gap-1.5" data-tour="invite-send">
            <button type="button" onClick={() => onCopy(c)} className={sendBtn} aria-label={`Copy invite message for ${c.code}`}>
              {copied === c.id ? <Check size={13} /> : <Copy size={13} />} {copied === c.id ? "Copied" : "Copy"}
            </button>
            {/* Opens your own mail or messages app with the invite written; you pick the DJ and send it. */}
            <a href={`mailto:?subject=${encodeURIComponent("Your Digital Crate DJs invite")}&body=${encodeURIComponent(inviteMessage(c.code))}`} className={sendBtn}>
              <Mail size={13} /> Email
            </a>
            <a href={`sms:?&body=${encodeURIComponent(inviteMessage(c.code))}`} className={sendBtn}>
              <MessageSquare size={13} /> Text
            </a>
          </div>
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
