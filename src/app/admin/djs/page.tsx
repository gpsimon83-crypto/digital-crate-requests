"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { NeonButton } from "@/components/ui/neon-button";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { DEFAULT_HERO_SETTINGS, mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";

interface DjRow {
  id: string;
  display_name: string;
  auth_user_id: string | null;
  photo_url: string | null;
  hero_settings: Partial<HeroSettings> | null;
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
  const [invited, setInvited] = useState<{ djId: string; email: string } | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [heroTarget, setHeroTarget] = useState<string | null>(null);
  const [heroDraft, setHeroDraft] = useState<HeroSettings>(DEFAULT_HERO_SETTINGS);

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
      setInvited(null);
      setLoginTarget(null);
      setLoginEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCreatingLogin(false);
    }
  }

  async function handleSendInvite(djId: string) {
    if (!loginEmail.trim()) return;
    setSendingInvite(true);
    try {
      const res = await fetch(`/api/admin/djs/${djId}/send-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: loginEmail.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send invite");
      setInvited({ djId, email: data.email });
      setCredentials(null);
      setLoginTarget(null);
      setLoginEmail("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSendingInvite(false);
    }
  }

  async function handleSaveName(djId: string) {
    if (!editName.trim()) return;
    setSavingId(djId);
    try {
      const res = await fetch(`/api/admin/djs/${djId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: editName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update name");
      setEditingId(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingId(null);
    }
  }

  async function handleSaveHero(djId: string) {
    setSavingId(djId);
    try {
      const res = await fetch(`/api/admin/djs/${djId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroSettings: heroDraft }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save hero settings");
      setHeroTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingId(null);
    }
  }

  async function handlePhotoSelected(djId: string, file: File) {
    setSavingId(djId);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch(`/api/admin/djs/${djId}`, { method: "PATCH", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload photo");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingId(null);
    }
  }

  return (
    <>
      <PageHeader title="Manage DJs" subtitle="Add DJs to the roster, edit their name and photo, and create their dashboard login." />
      <div className="flex flex-col gap-6 p-6">
        <GlassCard neon className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="block flex-1">
            <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">New DJ Name</span>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="DJ Example"
              className="w-full rounded-xl border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
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

        {invited && (
          <GlassCard className="border border-gold/40 text-sm">
            <p className="mb-2 font-semibold text-gold">Invite sent</p>
            <p>
              An email went to <span className="font-mono">{invited.email}</span> with a link to set their own
              password — nothing to share manually.
            </p>
          </GlassCard>
        )}

        <div className="flex flex-col gap-3">
          {djs === null && <p className="text-sm text-muted">Loading...</p>}
          {djs?.map((dj) => (
            <GlassCard key={dj.id} className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="relative shrink-0">
                    <DjAvatar name={dj.display_name} photoUrl={dj.photo_url} size={48} />
                    <input
                      ref={(el) => {
                        fileInputs.current[dj.id] = el;
                      }}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoSelected(dj.id, file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      onClick={() => fileInputs.current[dj.id]?.click()}
                      disabled={savingId === dj.id}
                      className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-black disabled:opacity-50"
                      title="Change photo"
                    >
                      ✎
                    </button>
                  </div>

                  {editingId === dj.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="rounded-lg border border-black/10 bg-panel px-3 py-1.5 text-sm focus:border-gold focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={() => handleSaveName(dj.id)}
                        disabled={savingId === dj.id}
                        className="rounded-full bg-gold px-3 py-1 text-xs font-semibold text-black disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="rounded-full border border-black/15 px-3 py-1 text-xs text-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setEditingId(dj.id);
                        setEditName(dj.display_name);
                      }}
                      className="font-semibold hover:text-gold"
                      title="Click to rename"
                    >
                      {dj.display_name}
                    </button>
                  )}
                </div>
                {dj.auth_user_id ? (
                  <span className="status-badge approved shrink-0">Has Login</span>
                ) : (
                  <span className="status-badge pending shrink-0">No Login</span>
                )}
              </div>

              <div className="flex gap-2">
                {!dj.auth_user_id && loginTarget !== dj.id && (
                  <button
                    onClick={() => setLoginTarget(dj.id)}
                    className="w-fit rounded-full border border-black/15 px-3 py-1.5 text-xs text-muted hover:text-foreground"
                  >
                    Create Login
                  </button>
                )}
                <button
                  onClick={() => {
                    if (heroTarget === dj.id) {
                      setHeroTarget(null);
                    } else {
                      setHeroTarget(dj.id);
                      setHeroDraft(mergeHeroSettings(dj.hero_settings));
                    }
                  }}
                  className="w-fit rounded-full border border-black/15 px-3 py-1.5 text-xs text-muted hover:text-foreground"
                >
                  Hero Settings
                </button>
                <button
                  onClick={() => handleDelete(dj.id)}
                  className="w-fit rounded-full border border-status-declined/40 px-3 py-1.5 text-xs text-status-declined"
                >
                  Remove
                </button>
              </div>

              {heroTarget === dj.id && (
                <div className="flex flex-col gap-4 rounded-xl border border-gold/20 bg-panel p-4">
                  <HeroSlider label="Horizontal Position" value={heroDraft.xPosition} min={0} max={100} onChange={(v) => setHeroDraft((s) => ({ ...s, xPosition: v }))} />
                  <HeroSlider label="Vertical Position" value={heroDraft.yPosition} min={0} max={100} onChange={(v) => setHeroDraft((s) => ({ ...s, yPosition: v }))} />
                  <HeroSlider label="Zoom" value={heroDraft.zoom} min={100} max={180} suffix="%" onChange={(v) => setHeroDraft((s) => ({ ...s, zoom: v }))} />
                  <HeroSlider label="Overlay Darkness" value={heroDraft.overlayDarkness} min={0} max={80} suffix="%" onChange={(v) => setHeroDraft((s) => ({ ...s, overlayDarkness: v }))} />
                  <div className="flex gap-2">
                    <NeonButton color="gold" onClick={() => handleSaveHero(dj.id)} disabled={savingId === dj.id} className="px-4 py-2 text-xs">
                      {savingId === dj.id ? "Saving..." : "Save"}
                    </NeonButton>
                    <button onClick={() => setHeroTarget(null)} className="rounded-full border border-black/15 px-4 py-2 text-xs text-muted">
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {loginTarget === dj.id && (
                <div className="flex flex-col gap-2 sm:flex-row">
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="dj@email.com"
                    className="flex-1 rounded-xl border border-black/10 bg-panel px-4 py-2 text-sm focus:border-gold focus:outline-none"
                  />
                  <NeonButton
                    color="gold"
                    onClick={() => handleSendInvite(dj.id)}
                    disabled={sendingInvite || creatingLogin}
                    className="px-4 py-2 text-xs"
                    title="Email the DJ a link to set their own password"
                  >
                    {sendingInvite ? "Sending..." : "Send Invite Email"}
                  </NeonButton>
                  <NeonButton
                    color="gold"
                    onClick={() => handleCreateLogin(dj.id)}
                    disabled={creatingLogin || sendingInvite}
                    className="px-4 py-2 text-xs"
                    title="Generate a temp password to hand the DJ yourself"
                  >
                    {creatingLogin ? "Creating..." : "Create (temp password)"}
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

function HeroSlider({
  label,
  value,
  min,
  max,
  suffix = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  suffix?: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="flex items-center justify-between text-[11px] uppercase tracking-wide text-muted">
        {label}
        <span className="text-gold">
          {value}
          {suffix}
        </span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-gold"
      />
    </label>
  );
}
