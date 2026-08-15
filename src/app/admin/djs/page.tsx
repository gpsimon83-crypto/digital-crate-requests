"use client";

import { useEffect, useRef, useState } from "react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { DEFAULT_HERO_SETTINGS, mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";
import { StatusChip } from "@/components/ui/status-chip";
import { DataTable, type DataTableColumn } from "@/components/ui/data-table";
import { SideDrawer } from "@/components/ui/side-drawer";
import { Disc3 } from "lucide-react";

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
  const [loginEmail, setLoginEmail] = useState("");
  const [credentials, setCredentials] = useState<{ djId: string; email: string; tempPassword: string } | null>(null);
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [invited, setInvited] = useState<{ djId: string; email: string } | null>(null);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [editName, setEditName] = useState("");
  const [savingId, setSavingId] = useState<string | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [heroDraft, setHeroDraft] = useState<HeroSettings>(DEFAULT_HERO_SETTINGS);
  const [drawerDjId, setDrawerDjId] = useState<string | null>(null);

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

  function openDrawer(dj: DjRow) {
    setDrawerDjId(dj.id);
    setEditName(dj.display_name);
    setHeroDraft(mergeHeroSettings(dj.hero_settings));
    setLoginEmail("");
  }

  function closeDrawer() {
    setDrawerDjId(null);
  }

  const drawerDj = djs?.find((d) => d.id === drawerDjId) ?? null;

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
      closeDrawer();
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
              className="w-full rounded-[10px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none"
            />
          </label>
          <Button variant="cta" onClick={handleAdd} disabled={adding} className="shrink-0">
            {adding ? "Adding..." : "+ Add DJ"}
          </Button>
        </GlassCard>

        {error && <p className="text-xs text-status-declined">{error}</p>}

        <DataTable
          columns={columns(openDrawer)}
          rows={djs ?? []}
          rowKey={(dj) => dj.id}
          onRowClick={openDrawer}
          loading={djs === null}
          searchFn={(dj, q) => dj.display_name.toLowerCase().includes(q)}
          searchPlaceholder="Search DJs…"
          emptyIcon={Disc3}
          emptyTitle="No DJs yet"
          emptyBody="Add your first DJ to the roster."
        />
      </div>

      <SideDrawer open={!!drawerDj} onClose={closeDrawer} title={drawerDj?.display_name ?? ""} subtitle="DJ profile">
        {drawerDj && (
          <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3">
              <div className="relative shrink-0">
                <DjAvatar name={drawerDj.display_name} photoUrl={drawerDj.photo_url} size={56} />
                <input
                  ref={(el) => {
                    fileInputs.current[drawerDj.id] = el;
                  }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handlePhotoSelected(drawerDj.id, file);
                    e.target.value = "";
                  }}
                />
                <button
                  onClick={() => fileInputs.current[drawerDj.id]?.click()}
                  disabled={savingId === drawerDj.id}
                  className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-[10px] font-bold text-black disabled:opacity-50"
                  title="Change photo"
                >
                  ✎
                </button>
              </div>
              {drawerDj.auth_user_id ? (
                <StatusChip tone="approved">Has Login</StatusChip>
              ) : (
                <StatusChip tone="pending">No Login</StatusChip>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <span className="text-xs uppercase tracking-wide text-muted">Display Name</span>
              <div className="flex items-center gap-2">
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
                <Button variant="primary" size="sm" onClick={() => handleSaveName(drawerDj.id)} disabled={savingId === drawerDj.id}>
                  Save
                </Button>
              </div>
            </div>

            {!drawerDj.auth_user_id && (
              <div className="flex flex-col gap-2">
                <span className="text-xs uppercase tracking-wide text-muted">Create Login</span>
                <input
                  type="email"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  placeholder="dj@email.com"
                  className="rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none"
                />
                <div className="flex gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleSendInvite(drawerDj.id)}
                    disabled={sendingInvite || creatingLogin}
                    title="Email the DJ a link to set their own password"
                  >
                    {sendingInvite ? "Sending..." : "Send Invite Email"}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleCreateLogin(drawerDj.id)}
                    disabled={creatingLogin || sendingInvite}
                    title="Generate a temp password to hand the DJ yourself"
                  >
                    {creatingLogin ? "Creating..." : "Temp Password"}
                  </Button>
                </div>
                {credentials?.djId === drawerDj.id && (
                  <GlassCard className="border border-gold/40 text-xs">
                    <p className="mb-1 font-semibold text-gold">Share this with the DJ once:</p>
                    <p>
                      Email: <span className="font-mono">{credentials.email}</span>
                    </p>
                    <p>
                      Password: <span className="font-mono">{credentials.tempPassword}</span>
                    </p>
                  </GlassCard>
                )}
                {invited?.djId === drawerDj.id && (
                  <p className="text-xs text-status-approved">Invite sent to {invited.email}.</p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <span className="text-xs uppercase tracking-wide text-muted">Hero Settings</span>
              <HeroSlider label="Horizontal Position" value={heroDraft.xPosition} min={0} max={100} onChange={(v) => setHeroDraft((s) => ({ ...s, xPosition: v }))} />
              <HeroSlider label="Vertical Position" value={heroDraft.yPosition} min={0} max={100} onChange={(v) => setHeroDraft((s) => ({ ...s, yPosition: v }))} />
              <HeroSlider label="Zoom" value={heroDraft.zoom} min={100} max={180} suffix="%" onChange={(v) => setHeroDraft((s) => ({ ...s, zoom: v }))} />
              <HeroSlider label="Overlay Darkness" value={heroDraft.overlayDarkness} min={0} max={80} suffix="%" onChange={(v) => setHeroDraft((s) => ({ ...s, overlayDarkness: v }))} />
              <Button variant="primary" size="sm" onClick={() => handleSaveHero(drawerDj.id)} disabled={savingId === drawerDj.id} className="w-fit">
                {savingId === drawerDj.id ? "Saving..." : "Save Hero Settings"}
              </Button>
            </div>

            <Button variant="destructive" size="sm" onClick={() => handleDelete(drawerDj.id)} className="w-fit">
              Remove from Roster
            </Button>
          </div>
        )}
      </SideDrawer>
    </>
  );
}

function columns(onEdit: (dj: DjRow) => void): DataTableColumn<DjRow>[] {
  return [
    {
      key: "name",
      header: "Name",
      sortValue: (dj) => dj.display_name,
      render: (dj) => (
        <span className="flex items-center gap-2.5">
          <DjAvatar name={dj.display_name} photoUrl={dj.photo_url} size={28} />
          <span className="font-medium">{dj.display_name}</span>
        </span>
      )
    },
    {
      key: "login",
      header: "Login",
      sortValue: (dj) => (dj.auth_user_id ? 1 : 0),
      render: (dj) =>
        dj.auth_user_id ? <StatusChip tone="approved">Has Login</StatusChip> : <StatusChip tone="pending">No Login</StatusChip>
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (dj) => (
        <button onClick={() => onEdit(dj)} className="text-xs text-gold hover:underline">
          Manage
        </button>
      )
    }
  ];
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
