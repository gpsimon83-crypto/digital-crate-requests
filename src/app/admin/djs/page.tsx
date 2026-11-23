"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { DEFAULT_HERO_SETTINGS, mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";
import { DjRosterCard, AccessChip, type RosterDj } from "@/components/admin/dj-roster-card";
import { FieldGroup, INPUT, MetricRow, MetricTile, PageShell } from "@/components/layout/grid";
import { inFilter, type AccessFilter, type PortalAccess } from "@/lib/dj/portal-access";
import { SideDrawer } from "@/components/ui/side-drawer";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { cn } from "@/lib/utils";
import { Disc3, ArrowUpRight, PenLine, Mail, SlidersHorizontal, AlertTriangle, Plus, Users, LogIn, UserX, Search, X, type LucideIcon } from "lucide-react";

type DjRow = RosterDj;
type SortKey = "az" | "za" | "access";
const SORTS: { key: SortKey; label: string }[] = [
  { key: "az", label: "Sort A–Z" },
  { key: "za", label: "Sort Z–A" },
  { key: "access", label: "Portal access" }
];
const ACCESS_ORDER: PortalAccess[] = ["active", "invited", "setup_sent", "disabled", "missing", "none"];

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
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<AccessFilter>("all");
  const [sort, setSort] = useState<SortKey>("az");
  const [notice, setNotice] = useState<string | null>(null);
  const photoCard = useRef<HTMLDivElement>(null);
  const focusPhoto = useRef(false);

  async function load() {
    try {
      const res = await fetch("/api/admin/djs/roster");
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
      setAddOpen(false);
      setNotice(`${data.dj?.display_name ?? "The DJ"} is on the roster.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setAdding(false);
    }
  }

  async function handleDelete(djId: string) {
    try {
      const res = await fetch(`/api/admin/djs/${djId}`, { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove DJ");
      closeDrawer();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPendingDeleteId(null);
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

  async function viewAs(dj: DjRow) {
    setError(null);
    try {
      const res = await fetch("/api/admin/view-as", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ djId: dj.id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't switch views");
      window.location.assign("/dj-dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function copySetupLink(dj: DjRow) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/djs/${dj.id}/setup-link`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't make a setup link");
      await navigator.clipboard.writeText(data.link).catch(() => {});
      setNotice(`Setup link for ${dj.display_name} copied. Paste it into a text or email (Manage profile has Email and Text buttons too).`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  // The photo button on a card opens Quick edit at the photo (upload and framing).
  useEffect(() => {
    if (!focusPhoto.current || !drawerDjId) return;
    focusPhoto.current = false;
    const t = setTimeout(() => {
      photoCard.current?.scrollIntoView({ block: "start" });
      photoCard.current?.querySelector<HTMLButtonElement>("button")?.focus();
    }, 150);
    return () => clearTimeout(t);
  }, [drawerDjId]);

  const list = djs ?? [];
  const counts = {
    total: list.length,
    active: list.filter((d) => d.access === "active").length,
    none: list.filter((d) => d.access === "none").length,
    pending: list.filter((d) => inFilter(d.access, "pending")).length
  };
  const term = q.trim().toLowerCase();
  // A–Z goes by the name after "DJ " (Bubblz, GMO, Hy Def, J.Prime, MaKara…), the way the team reads it.
  const sortName = (n: string) => n.replace(/^DJ\s+/i, "");
  const byName = (a: DjRow, b: DjRow) => sortName(a.display_name).localeCompare(sortName(b.display_name), undefined, { sensitivity: "base" });
  const shown = list
    .filter((d) => inFilter(d.access, filter) && (!term || d.display_name.toLowerCase().includes(term)))
    .sort((a, b) => (sort === "za" ? byName(b, a) : sort === "access" ? ACCESS_ORDER.indexOf(a.access) - ACCESS_ORDER.indexOf(b.access) || byName(a, b) : byName(a, b)));
  const FILTERS: { key: AccessFilter; label: string; n: number }[] = [
    { key: "all", label: "All DJs", n: counts.total },
    { key: "active", label: "Portal active", n: counts.active },
    ...(counts.pending ? [{ key: "pending" as const, label: "Pending or blocked", n: counts.pending }] : []),
    { key: "none", label: "Not connected", n: counts.none }
  ];

  return (
    <>
      <PageHeader
        title="Manage DJs"
        subtitle="Your roster, profiles and portal access."
        action={
          <Button variant="cta" onClick={() => setAddOpen(true)} className="w-fit" data-tour="dj-add">
            <Plus size={16} aria-hidden /> Add DJ
          </Button>
        }
      />
      <PageShell className="flex flex-col gap-4 xl:gap-5">
        {error && (
          <p role="alert" className="rounded-[10px] border border-status-declined/40 px-3 py-2 text-sm text-status-declined">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="flex items-start justify-between gap-3 rounded-[10px] border border-status-approved/40 px-3 py-2 text-sm">
            {notice}
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="shrink-0 rounded-[6px] text-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              <X size={15} aria-hidden />
            </button>
          </p>
        )}

        <MetricRow cols={3} data-tour="dj-roster-counts">
          <MetricTile icon={Users} label="Total DJs" value={djs === null ? "…" : counts.total} />
          <MetricTile icon={LogIn} label="Portal active" value={djs === null ? "…" : counts.active} hint="Have a working portal login" />
          <MetricTile icon={UserX} label="Not connected" value={djs === null ? "…" : counts.none} hint={counts.pending ? `${counts.pending} more with an invite or setup link pending` : "No portal login yet"} />
        </MetricRow>

        <div className="flex flex-wrap items-center gap-3" data-tour="dj-roster-toolbar">
          <label className="relative w-full sm:w-72">
            <span className="sr-only">Search DJs</span>
            <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search DJs…" className={`${INPUT} h-10 pl-9`} />
          </label>
          <div role="group" aria-label="Filter by portal access" className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]",
                  filter === f.key ? "border-gold bg-gold font-semibold text-[var(--on-gold,#1a140a)]" : "border-border hover:border-gold/60"
                )}
              >
                {f.label}
                <span className={cn("text-xs tabular-nums", filter === f.key ? "opacity-80" : "text-muted")}>{djs === null ? "" : f.n}</span>
              </button>
            ))}
          </div>
          <label className="ml-auto">
            <span className="sr-only">Sort</span>
            <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={`${INPUT} h-10 w-auto pr-8`}>
              {SORTS.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {djs === null ? (
          <ul aria-label="Loading the roster" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-5 2xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, i) => (
              <li key={i} className="glass-card h-[340px] animate-pulse !p-0" aria-hidden />
            ))}
          </ul>
        ) : list.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-3 px-6 py-12 text-center">
            <Disc3 size={26} className="text-gold" aria-hidden />
            <p className="font-semibold">No DJs yet</p>
            <p className="text-sm text-muted">Add your first DJ to the roster.</p>
            <Button variant="cta" onClick={() => setAddOpen(true)} className="w-fit">
              <Plus size={16} aria-hidden /> Add DJ
            </Button>
          </div>
        ) : shown.length === 0 ? (
          <div className="glass-card flex flex-col items-center gap-2 px-6 py-10 text-center">
            <p className="font-semibold">No DJs match</p>
            <p className="text-sm text-muted">{term ? `Nothing for "${q.trim()}"` : "No DJs in this group"}{filter !== "all" ? ` with ${FILTERS.find((f) => f.key === filter)?.label.toLowerCase()}` : ""}.</p>
            <button type="button" onClick={() => { setQ(""); setFilter("all"); }} className="mt-1 rounded-[8px] text-sm font-semibold text-gold hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold">
              Clear search and filters
            </button>
          </div>
        ) : (
          <>
            <p className="sr-only" aria-live="polite">{shown.length} of {list.length} DJs shown</p>
            <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:gap-5 2xl:grid-cols-4" data-tour="dj-roster-grid">
              {shown.map((dj) => (
                <li key={dj.id} className="flex">
                  <div className="flex w-full">
                    <DjRosterCard
                      dj={dj}
                      onEditPhoto={() => {
                        focusPhoto.current = true;
                        openDrawer(dj);
                      }}
                      onQuickEdit={() => openDrawer(dj)}
                      onViewAs={() => viewAs(dj)}
                      onSetupLink={dj.access === "none" || dj.access === "setup_sent" ? () => copySetupLink(dj) : undefined}
                      onRemove={() => setPendingDeleteId(dj.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </PageShell>

      <SideDrawer open={addOpen} onClose={() => setAddOpen(false)} title="Add a DJ" subtitle="They join the roster right away. You can add a photo and a portal login next.">
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            handleAdd();
          }}
        >
          <FieldGroup label="DJ name" htmlFor="new-dj-name">
            <input id="new-dj-name" autoFocus value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="DJ Example" className={INPUT} required />
          </FieldGroup>
          <Button variant="cta" type="submit" disabled={adding || !newName.trim()} className="w-fit">
            {adding ? "Adding..." : "Add DJ"}
          </Button>
        </form>
      </SideDrawer>

      <SideDrawer open={!!drawerDj} onClose={closeDrawer} title={drawerDj?.display_name ?? ""} subtitle="Quick edit">
        {drawerDj && (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Link href={`/admin/djs/${drawerDj.id}`} className="flex w-fit items-center gap-1 text-xs text-gold hover:underline">
                View full profile <ArrowUpRight size={12} />
              </Link>
              <AccessChip access={drawerDj.access} />
            </div>

            <div ref={photoCard}>
            <GlassCard className="flex items-center gap-4">
              <DjAvatar name={drawerDj.display_name} photoUrl={drawerDj.photo_url} size={64} />
              <div className="flex-1">
                <p className="font-semibold">Photo</p>
                <p className="text-xs text-muted">Used across the DJ Portal and as the event hero image.</p>
              </div>
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
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputs.current[drawerDj.id]?.click()}
                disabled={savingId === drawerDj.id}
                className="shrink-0"
              >
                {savingId === drawerDj.id ? "Uploading…" : "Browse…"}
              </Button>
            </GlassCard>
            </div>

            <GlassCard className="flex flex-col gap-3">
              <SectionHeader icon={PenLine} title="Display Name" />
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
            </GlassCard>

            {!drawerDj.auth_user_id && (
              <GlassCard className="flex flex-col gap-3">
                <SectionHeader icon={Mail} title="Dashboard Login" description="Give this DJ access to their own dashboard." />
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
                  <div className="rounded-[10px] border border-gold/40 bg-gold/5 p-3 text-xs">
                    <p className="mb-1 font-semibold text-gold">Share this with the DJ once:</p>
                    <p>
                      Email: <span className="font-mono">{credentials.email}</span>
                    </p>
                    <p>
                      Password: <span className="font-mono">{credentials.tempPassword}</span>
                    </p>
                  </div>
                )}
                {invited?.djId === drawerDj.id && (
                  <p className="text-xs text-status-approved">Invite sent to {invited.email}.</p>
                )}
              </GlassCard>
            )}

            <GlassCard className="flex flex-col gap-4">
              <SectionHeader icon={SlidersHorizontal} title="Hero Image" description="How this DJ's photo is framed on event pages." />
              <HeroSlider label="Horizontal Position" value={heroDraft.xPosition} min={0} max={100} onChange={(v) => setHeroDraft((s) => ({ ...s, xPosition: v }))} />
              <HeroSlider label="Vertical Position" value={heroDraft.yPosition} min={0} max={100} onChange={(v) => setHeroDraft((s) => ({ ...s, yPosition: v }))} />
              <HeroSlider label="Zoom" value={heroDraft.zoom} min={100} max={180} suffix="%" onChange={(v) => setHeroDraft((s) => ({ ...s, zoom: v }))} />
              <HeroSlider label="Overlay Darkness" value={heroDraft.overlayDarkness} min={0} max={80} suffix="%" onChange={(v) => setHeroDraft((s) => ({ ...s, overlayDarkness: v }))} />
              <div className="flex items-center gap-3">
                <Button variant="primary" size="sm" onClick={() => handleSaveHero(drawerDj.id)} disabled={savingId === drawerDj.id} className="w-fit">
                  {savingId === drawerDj.id ? "Saving..." : "Save"}
                </Button>
                <button
                  onClick={() => setHeroDraft(DEFAULT_HERO_SETTINGS)}
                  className="ml-auto text-xs text-muted hover:text-foreground"
                >
                  Restore Default
                </button>
              </div>
            </GlassCard>

            <div className="rounded-[10px] border border-status-declined/25 bg-status-declined/5 p-4">
              <SectionHeader icon={AlertTriangle} title="Danger Zone" description="Remove this DJ from the roster. This cannot be undone." tone="destructive" />
              <Button variant="destructive" size="sm" onClick={() => setPendingDeleteId(drawerDj.id)} className="mt-3 w-fit">
                Remove from Roster
              </Button>
            </div>
          </div>
        )}
      </SideDrawer>

      <ConfirmModal
        open={!!pendingDeleteId}
        title="Remove this DJ from the roster?"
        body="This cannot be undone."
        confirmLabel="Remove"
        onConfirm={() => pendingDeleteId && handleDelete(pendingDeleteId)}
        onCancel={() => setPendingDeleteId(null)}
      />
    </>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  tone = "default"
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  tone?: "default" | "destructive";
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
          tone === "destructive" ? "bg-status-declined/10 text-status-declined" : "bg-gold/15 text-gold"
        )}
      >
        <Icon size={16} />
      </span>
      <div>
        <p className={cn("text-sm font-semibold", tone === "destructive" && "text-status-declined")}>{title}</p>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>
    </div>
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
