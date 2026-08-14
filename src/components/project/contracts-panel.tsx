"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { FileText, Download } from "lucide-react";

export interface ContractRow {
  id: string;
  event_id: string;
  template_id: string | null;
  status: "draft" | "sent" | "signed" | "void";
  title: string;
  body: string | null;
  file_url: string | null;
  file_name: string | null;
  sent_at: string | null;
  signed_at: string | null;
  signed_by_name: string | null;
  signed_ip: string | null;
  signed_user_agent: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

interface TemplateOption {
  id: string;
  title: string;
}

const STATUS_LABEL: Record<ContractRow["status"], string> = { draft: "Draft", sent: "Sent", signed: "Signed", void: "Void" };
const STATUS_TONE: Record<ContractRow["status"], string> = {
  draft: "muted",
  sent: "pending",
  signed: "approved",
  void: "declined"
};

export function ContractsPanel({ eventId, contracts, onChange }: { eventId: string; contracts: ContractRow[]; onChange: () => void }) {
  const [templates, setTemplates] = useState<TemplateOption[] | null>(null);
  const [templateId, setTemplateId] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingBody, setEditingBody] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/admin/library?category=contract_template")
      .then((r) => r.json())
      .then((data) => setTemplates((data.items ?? []).map((i: { id: string; title: string }) => ({ id: i.id, title: i.title }))))
      .catch(() => setTemplates([]));
  }, []);

  const current = contracts.find((c) => c.status !== "void") ?? null;
  const history = contracts.filter((c) => c.id !== current?.id);

  async function handleCreateDraft() {
    if (!templateId) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/events/${eventId}/contracts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create draft");
      setTemplateId("");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreating(false);
    }
  }

  async function patchContract(id: string, body: Record<string, unknown>) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/contracts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      onChange();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleSaveEdit() {
    if (!current) return;
    setSaving(true);
    await patchContract(current.id, { action: "edit", body: editingBody });
    setSaving(false);
    setIsEditing(false);
  }

  async function handleVoid(id: string) {
    const reason = window.prompt("Reason for voiding this contract? (optional)") ?? undefined;
    await patchContract(id, { action: "void", reason });
  }

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <FileText size={16} className="text-gold" />
        <p className="text-sm font-medium">Contract</p>
      </div>
      {error && <p className="text-xs text-status-declined">{error}</p>}

      {!current && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted">No contract in flight for this project yet.</p>
          {templates === null ? (
            <p className="text-xs text-muted">Loading templates…</p>
          ) : templates.length === 0 ? (
            <p className="text-xs text-muted">
              No contract templates yet — add one in the Library (category: Contract Template), or upload a signed-off PDF from the Files
              tab instead.
            </p>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <select
                value={templateId}
                onChange={(e) => setTemplateId(e.target.value)}
                className="flex-1 rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
              >
                <option value="">Select a template…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </select>
              <Button variant="primary" size="sm" onClick={handleCreateDraft} disabled={!templateId || creating}>
                {creating ? "Creating…" : "Create Draft"}
              </Button>
            </div>
          )}
        </div>
      )}

      {current && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium">{current.title}</p>
              <span className={cn("status-dot", STATUS_TONE[current.status])}>{STATUS_LABEL[current.status]}</span>
            </div>
            {current.file_url && (
              <a href={current.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-gold hover:underline">
                <Download size={12} /> Open file
              </a>
            )}
          </div>

          {current.status === "draft" && current.body != null && (
            <>
              {isEditing ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                    className="min-h-[200px] w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </Button>
                    <Button variant="secondary" size="sm" onClick={() => setIsEditing(false)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[2px] border border-black/10 bg-panel/60 p-3 text-xs text-muted">
                  {current.body}
                </div>
              )}
              {!isEditing && (
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setEditingBody(current.body ?? "");
                      setIsEditing(true);
                    }}
                  >
                    Edit text
                  </Button>
                  <Button variant="primary" size="sm" onClick={() => patchContract(current.id, { action: "send" })}>
                    Send to client
                  </Button>
                </div>
              )}
            </>
          )}

          {current.status === "sent" && (
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted">Sent {current.sent_at ? new Date(current.sent_at).toLocaleString() : "—"} — awaiting signature.</p>
              <Button variant="destructive" size="sm" onClick={() => handleVoid(current.id)}>
                Void
              </Button>
            </div>
          )}

          {current.status === "signed" && (
            <p className="text-xs text-muted">
              Signed by {current.signed_by_name} on {current.signed_at ? new Date(current.signed_at).toLocaleString() : "—"}
              {current.signed_ip ? ` from ${current.signed_ip}` : ""}
            </p>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div className="flex flex-col gap-1 border-t border-border pt-3">
          <p className="mb-1 text-[10px] uppercase tracking-[1.5px] text-muted">History</p>
          {history.map((c) => (
            <div key={c.id} className="flex items-center justify-between text-xs text-muted">
              <span>
                {c.title} — {STATUS_LABEL[c.status]}
                {c.void_reason ? ` (${c.void_reason})` : ""}
              </span>
              <span>{new Date(c.created_at).toLocaleDateString()}</span>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}
