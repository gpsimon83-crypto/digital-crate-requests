"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, LayoutDashboard, CalendarDays, Disc3, MapPin, KeyRound, Settings,
  ListMusic, BarChart3, DollarSign, LayoutTemplate, Mail, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { DjAvatar } from "@/components/dashboard/dj-avatar";
import { DEFAULT_HERO_SETTINGS, mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";
import { isStaffRole } from "@/lib/roles";

const ADMIN_SECTIONS: { href: string; label: string; desc: string; icon: LucideIcon }[] = [
  { href: "/admin", label: "Overview", desc: "Revenue, activity, and at-a-glance stats.", icon: LayoutDashboard },
  { href: "/admin/events", label: "Events", desc: "Create and manage every event.", icon: CalendarDays },
  { href: "/admin/djs", label: "DJs", desc: "Add DJs, photos, and logins.", icon: Disc3 },
  { href: "/admin/venues", label: "Venues", desc: "Manage the venue list.", icon: MapPin },
  { href: "/admin/crate-templates", label: "Crate Templates", desc: "Reusable crate starting points.", icon: LayoutTemplate },
  { href: "/admin/monetization", label: "Monetization", desc: "Pricing for tips, boosts, and requests.", icon: DollarSign },
  { href: "/admin/invite-codes", label: "Invite Codes", desc: "Generate DJ signup codes.", icon: KeyRound },
  { href: "/admin/settings", label: "Settings", desc: "App-wide configuration.", icon: Settings },
  { href: "/dj-dashboard/bookings", label: "All Bookings", desc: "Every DJ's events in one list.", icon: ListMusic },
  { href: "/analytics", label: "Analytics", desc: "Revenue and top DJs/venues.", icon: BarChart3 },
];

function BackToBookings() {
  return (
    <Link
      href="/dj-dashboard/bookings"
      className="flex items-center gap-1.5 rounded-[2px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-black/25 hover:text-foreground"
    >
      <ArrowLeft size={14} /> Back to Bookings
    </Link>
  );
}

interface DjRecord {
  id: string;
  display_name: string;
  photo_url: string | null;
  hero_settings: Partial<HeroSettings> | null;
}

interface EmailAccount {
  emailAddress: string;
  smtpHost: string;
  smtpPort: number;
  imapHost: string;
  imapPort: number;
  lastCheckedAt: string | null;
}

export default function DjProfilePage() {
  const [dj, setDj] = useState<DjRecord | null>(null);
  const [settings, setSettings] = useState<HeroSettings>(DEFAULT_HERO_SETTINGS);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasDj, setHasDj] = useState(false);
  const [checkingRole, setCheckingRole] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  const [emailAccount, setEmailAccount] = useState<EmailAccount | null>(null);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [emailForm, setEmailForm] = useState({
    emailAddress: "",
    password: "",
    smtpHost: "netsol-smtp-oxcs.hostingplatform.com",
    smtpPort: 587,
    imapHost: "netsol-imap-oxcs.hostingplatform.com",
    imapPort: 993
  });
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/dj/profile");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load profile");
      setDj(data.dj);
      setSettings(mergeHeroSettings(data.dj.hero_settings));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function loadEmailAccount() {
    try {
      const res = await fetch("/api/dj/email-account");
      const data = await res.json();
      if (res.ok) setEmailAccount(data.account);
    } catch {
      // leave emailAccount null — the connect card will just show as not-connected
    }
  }

  async function handleSaveEmailAccount() {
    setSavingEmail(true);
    setEmailError(null);
    try {
      const res = await fetch("/api/dj/email-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailForm)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to connect");
      setEmailAccount(data.account);
      setShowEmailForm(false);
      setEmailForm((f) => ({ ...f, password: "" }));
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingEmail(false);
    }
  }

  async function handleDisconnectEmail() {
    setSavingEmail(true);
    setEmailError(null);
    try {
      const res = await fetch("/api/dj/email-account", { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to disconnect");
      setEmailAccount(null);
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingEmail(false);
    }
  }

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        setIsAdmin(isStaffRole(d?.user?.role));
        const djLinked = !!d?.dj;
        setHasDj(djLinked);
        // Staff and DJ aren't mutually exclusive — some staff accounts (the
        // owner performing as their own DJ, e.g.) are linked to a real djs
        // row and need the same photo/hero/email UI a DJ-only account gets.
        if (djLinked) {
          load();
          loadEmailAccount();
        }
      })
      .catch(() => load())
      .finally(() => setCheckingRole(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dj/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ heroSettings: settings }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhotoSelected(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("photo", file);
      const res = await fetch("/api/dj/profile", { method: "PATCH", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload photo");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(false);
    }
  }

  if (checkingRole) {
    return (
      <>
        <PageHeader title="My Profile" action={<BackToBookings />} />
        <p className="p-6 text-sm text-muted">Loading...</p>
      </>
    );
  }

  if (isAdmin && !hasDj) {
    return (
      <>
        <PageHeader
          title="My Profile"
          subtitle="Every admin control, in one place."
          action={<BackToBookings />}
        />
        <div className="grid grid-cols-1 gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
          {ADMIN_SECTIONS.map(({ href, label, desc, icon: Icon }) => (
            <Link key={href} href={href}>
              <GlassCard className="flex h-full flex-col gap-3 transition-transform hover:-translate-y-0.5">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gold/15 text-gold">
                  <Icon size={20} />
                </span>
                <div>
                  <p className="font-semibold">{label}</p>
                  <p className="mt-1 text-sm text-muted">{desc}</p>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      </>
    );
  }

  if (!dj) {
    return (
      <>
        <PageHeader
          title="My Profile"
          subtitle="Manage your photo and how your hero appears on event pages."
          action={<BackToBookings />}
        />
        <p className="p-6 text-sm text-muted">{error ?? "Loading..."}</p>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="My Profile"
        subtitle="Manage your photo and how your hero appears on event pages."
        action={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link
                href="/admin"
                className="flex items-center gap-1.5 rounded-[2px] border border-gold/40 px-3.5 py-2 text-xs font-semibold text-gold transition-colors hover:bg-gold/10"
              >
                <LayoutDashboard size={14} /> Admin Panel
              </Link>
            )}
            <BackToBookings />
          </div>
        }
      />
      <div className="flex flex-col gap-6 p-6">
        {error && <p className="text-xs text-status-declined">{error}</p>}

        <GlassCard className="flex items-center gap-4">
          <DjAvatar name={dj.display_name} photoUrl={dj.photo_url} size={64} />
          <div className="flex-1">
            <p className="font-semibold">{dj.display_name}</p>
            <p className="text-xs text-muted">This photo is used across the DJ Portal and as your event hero image.</p>
          </div>
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handlePhotoSelected(file);
              e.target.value = "";
            }}
          />
          <Button
            variant="primary"
            size="sm"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="shrink-0"
          >
            {uploading ? "Uploading..." : "Change Photo"}
          </Button>
        </GlassCard>

        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold/15 text-gold">
              <Mail size={18} />
            </span>
            <div className="flex-1">
              <p className="font-semibold">Email</p>
              <p className="text-xs text-muted">Connect your mailbox to send and receive client email from a project&rsquo;s Activity tab.</p>
            </div>
          </div>

          {emailError && <p className="text-xs text-status-declined">{emailError}</p>}

          {emailAccount && !showEmailForm ? (
            <div className="flex items-center justify-between rounded-[2px] border border-status-approved/30 bg-status-approved/5 px-4 py-3">
              <div>
                <p className="text-sm font-medium text-status-approved">Connected</p>
                <p className="text-xs text-muted">{emailAccount.emailAddress}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowEmailForm(true)} className="text-xs text-gold hover:underline">
                  Edit
                </button>
                <button onClick={handleDisconnectEmail} disabled={savingEmail} className="text-xs text-status-declined hover:underline">
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <EmailField label="Email Address" value={emailForm.emailAddress} onChange={(v) => setEmailForm((f) => ({ ...f, emailAddress: v }))} placeholder="you@digitalcratedjs.com" />
              <EmailField label="Password" type="password" value={emailForm.password} onChange={(v) => setEmailForm((f) => ({ ...f, password: v }))} />
              <div className="grid gap-3 sm:grid-cols-2">
                <EmailField label="SMTP Server" value={emailForm.smtpHost} onChange={(v) => setEmailForm((f) => ({ ...f, smtpHost: v }))} />
                <EmailField
                  label="SMTP Port"
                  type="number"
                  value={String(emailForm.smtpPort)}
                  onChange={(v) => setEmailForm((f) => ({ ...f, smtpPort: Number(v) || 587 }))}
                />
                <EmailField label="IMAP Server" value={emailForm.imapHost} onChange={(v) => setEmailForm((f) => ({ ...f, imapHost: v }))} />
                <EmailField
                  label="IMAP Port"
                  type="number"
                  value={String(emailForm.imapPort)}
                  onChange={(v) => setEmailForm((f) => ({ ...f, imapPort: Number(v) || 993 }))}
                />
              </div>
              <div className="flex items-center gap-3">
                <Button variant="primary" size="sm" onClick={handleSaveEmailAccount} disabled={savingEmail}>
                  {savingEmail ? "Connecting..." : "Connect"}
                </Button>
                {emailAccount && (
                  <button onClick={() => setShowEmailForm(false)} className="text-xs text-muted hover:text-foreground">
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </GlassCard>

        {/* Live preview */}
        <GlassCard className="!p-0 overflow-hidden">
          <div className="relative h-[220px] w-full overflow-hidden">
            {dj.photo_url ? (
              <Image
                src={dj.photo_url}
                alt={dj.display_name}
                fill
                sizes="500px"
                className="object-cover"
                style={{ objectPosition: `${settings.xPosition}% ${settings.yPosition}%`, transform: `scale(${settings.zoom / 100})` }}
              />
            ) : (
              <div
                className="h-full w-full"
                style={{
                  background:
                    "radial-gradient(120% 140% at 85% 0%, rgba(186,139,75,0.16), transparent 60%), linear-gradient(160deg, #1a1610 0%, #0d0d0d 55%, #0a0a0a 100%)",
                }}
              />
            )}
            <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: `rgba(0,0,0,${settings.overlayDarkness / 100})` }} />
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 45%, transparent 75%)" }}
            />
            <div
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%]"
              style={{ background: "linear-gradient(to top, rgba(0,0,0,0.97) 0%, transparent 100%)" }}
            />
            <div className="absolute bottom-4 left-4">
              <span className="w-fit rounded-[2px] border border-gold/50 bg-black/30 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[2px] text-gold backdrop-blur-sm">
                Live Preview
              </span>
              <p className="gold-text-gradient mt-2 text-2xl font-extrabold">Sample Event</p>
              <p className="text-xs text-white/85">with {dj.display_name}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="flex flex-col gap-5">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Hero Image Controls</p>
          <SliderRow
            label="Horizontal Position"
            value={settings.xPosition}
            min={0}
            max={100}
            onChange={(v) => setSettings((s) => ({ ...s, xPosition: v }))}
          />
          <SliderRow
            label="Vertical Position"
            value={settings.yPosition}
            min={0}
            max={100}
            onChange={(v) => setSettings((s) => ({ ...s, yPosition: v }))}
          />
          <SliderRow
            label="Zoom"
            value={settings.zoom}
            min={100}
            max={180}
            suffix="%"
            onChange={(v) => setSettings((s) => ({ ...s, zoom: v }))}
          />
          <SliderRow
            label="Overlay Darkness"
            value={settings.overlayDarkness}
            min={0}
            max={80}
            suffix="%"
            onChange={(v) => setSettings((s) => ({ ...s, overlayDarkness: v }))}
          />

          <div className="flex items-center gap-3">
            <Button variant="cta" onClick={handleSave} disabled={saving} className="w-full sm:w-fit">
              {saving ? "Saving..." : "Save Hero Settings"}
            </Button>
            {saved && <span className="text-xs text-status-approved">Saved</span>}
            <button
              onClick={() => setSettings(DEFAULT_HERO_SETTINGS)}
              className="ml-auto rounded-[2px] border border-black/15 px-4 py-2 text-xs text-muted hover:text-foreground"
            >
              Restore Default
            </button>
          </div>
        </GlassCard>
      </div>
    </>
  );
}

function EmailField({
  label,
  value,
  onChange,
  type = "text",
  placeholder
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-[2px] border border-black/10 bg-panel px-3 py-2 text-sm placeholder:text-muted/60 focus:border-gold focus:outline-none"
      />
    </label>
  );
}

function SliderRow({
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
    <label className="flex flex-col gap-2">
      <span className="flex items-center justify-between text-xs uppercase tracking-wide text-muted">
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
