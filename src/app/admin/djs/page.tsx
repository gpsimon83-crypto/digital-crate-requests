"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";

interface DjRow {
  id: string;
  display_name: string;
  auth_user_id: string | null;
}

export default function AdminDjsPage() {
  const [djs, setDjs] = useState<DjRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [loginTarget, setLoginTarget] = useState<string | null>(null);
  const [loginEmail, setLoginEmail] = useState("");
  const [credentials, setCredentials] = useState<{ djId: string; email: string; tempPassword: string } | null>(null);
  const [creatingLogin, setCreatingLogin] = useState(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/djs");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load DJs");
      setDjs(data.djs ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAdd() {
    if (!newName.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/djs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: newName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add DJ");
      setNewName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(djId: string) {
    if (!confirm("Remove this DJ from the roster? This cannot be undone.")) return;
    try {
      const res = await fetch(`/api/admin/djs/${djId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove DJ");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function handleCreateLogin(djId: string) {
    if (!loginEmail.trim()) return;
    setCreatingLogin(true);
    try {
      const res = await fetch(`/api/admin/djs/${djId}/create-login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create login");
      setCredentials({ djId, email: data.email, tempPassword: data.tempPassword });
      setLoginTarget(null);
      setLoginEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreatingLogin(false);
    }
  }

  return (
    <>
      <PageHeader title="Manage DJs" subtitle="Add DJs to the roster and create their dashboard login." />
      <div className="flex flex-col gap-6 p-6">
        <GlassCard neon className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">New DJ Name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="DJ Example"
              className="w-full rounded-xl border border-white/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <NeonButton color="gold" onClick={handleAdd} disabled={adding} className="shrink-0">
            {adding ? "Adding..." : "+ Add DJ"}
          </NeonButton>
        </GlassCard>

        {error && <p className="text-xs text-status-declined">{error}</p>}

        {credentials && (
          <GlassCard className="border border-gold/40 text-sm">
            <p className="mb-2 font-semibold text-gold">Login created — share this with the DJ once:</p>
            <p>
              Email: <span className="font-mono">{credentials.email}</span>
            </p>
            <p>
              Temporary password: <span className="font-mono">{credentials.tempPassword}</span>
            </p>
            <p className="mt-2 text-xs text-muted">
              They can sign in at <span className="font-mono">/dj-dashboard/login</span>. This password won&apos;t be shown again.
            </p>
          </GlassCard>
        )}

        <div className="flex flex-col gap-3">
          {djs === null && <p className="text-sm text-muted">Loading...</p>}
          {djs?.map((dj) => (
            <GlassCard key={dj.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{dj.display_name}</p>
                {dj.auth_user_id ? (
                  <span className="status-badge approved">Has Login</span>
                ) : (
                  <span className="status-badge pending">No Login</span>
                )}
              </div>

              <div className="flex gap-2">
                {!dj.auth_user_id && loginTarget !== dj.id && (
                  <button
                    onClick={() => setLoginTarget(dj.id)}
                    className="w-fit rounded-full border border-white/15 px-3 py-1.5 text-xs text-muted hover:text-foreground"
                  >
                    Create Login
                  </button>
                )}
                <button
                  onClick={() => handleDelete(dj.id)}
                  className="w-fit rounded-full border border-status-declined/40 px-3 py-1.5 text-xs text-status-declined"
                >
                  Remove
                </button>
              </div>

              {loginTarget === dj.id && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="dj@email.com"
                    className="flex-1 rounded-xl border border-white/10 bg-panel px-4 py-2 text-sm focus:border-gold focus:outline-none"
                  />
                  <NeonButton
                    color="gold"
                    onClick={() => handleCreateLogin(dj.id)}
                    disabled={creatingLogin}
                    className="px-4 py-2 text-xs"
                  >
                    {creatingLogin ? "Creating..." : "Create"}
                  </NeonButton>
                </div>
              )}
            </GlassCard>
          ))}
        </div>
      </div>
    </>
  );
}
