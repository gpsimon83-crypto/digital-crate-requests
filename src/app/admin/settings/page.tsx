"use client";

import { PortalThemeSettings } from "@/components/admin/portal-theme-settings";
import { DashLayoutList, SiteThemeList } from "@/components/admin/site-theme";
import { PlaybookTimingSettings } from "@/components/admin/playbook-timing-settings";
import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { Field } from "@/components/ui/field";
import { HeroBanner } from "@/components/ui/hero-banner";
import { CoverPicker } from "@/components/project/cover-picker";
import { HeroCropControls } from "@/components/ui/hero-crop-controls";
import { mergeHeroSettings, type HeroSettings } from "@/lib/hero-settings";
import { ShieldCheck, ChevronRight, CalendarDays, Image as ImageIcon, Sparkles } from "lucide-react";

const HERO_COPY_EXAMPLES: Record<"portal" | "admin", { heading: string; subheading: string }> = {
  portal: {
    heading: "Welcome to your event hub",
    subheading: "Everything for your big day, all in one place."
  },
  admin: {
    heading: "Digital Crate DJs",
    subheading: "Book smarter, play better."
  }
};

function HeroImageUpload({
  imageUrl,
  uploading,
  onUpload,
  onClear
}: {
  imageUrl: string | null;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  return (
    <div>
      <span className="mb-1.5 block text-xs uppercase tracking-wide text-muted">Banner Image</span>
      <div className="flex items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
        <Button variant="secondary" size="sm" onClick={() => fileInput.current?.click()} disabled={uploading}>
          {uploading ? "Uploading…" : imageUrl ? "Replace image" : "Upload image"}
        </Button>
        {imageUrl && (
          <Button variant="text" size="sm" onClick={onClear} disabled={uploading}>
            Remove
          </Button>
        )}
      </div>
    </div>
  );
}

function CopyFieldWithAI({
  label,
  value,
  placeholder,
  onChange,
  onGenerate,
  generating
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
  onGenerate: () => void;
  generating: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <Field label={label} value={value} placeholder={placeholder} onChange={onChange} />
      <button
        type="button"
        onClick={onGenerate}
        disabled={generating}
        className="flex w-fit items-center gap-1 text-[11px] font-medium text-gold hover:underline disabled:opacity-60"
      >
        <Sparkles size={11} /> {generating ? "Writing…" : "Write with AI"}
      </button>
    </div>
  );
}

interface Settings {
  allow_dj_self_registration: boolean;
  require_disclaimer_acceptance: boolean;
  crowd_vote_boosts_enabled: boolean;
  push_notifications_enabled: boolean;
  portal_hero_image_url: string | null;
  portal_hero_heading: string | null;
  portal_hero_subheading: string | null;
  portal_hero_settings: Partial<HeroSettings> | null;
  admin_hero_image_url: string | null;
  admin_hero_heading: string | null;
  admin_hero_subheading: string | null;
  review_url: string | null;
  /** Migration 0063: undefined until it's run. */
  admin_club_image_url?: string | null;
  admin_dashboard_banners?: Partial<Record<"wedding" | "club", Partial<HeroSettings>>> | null;
  /** Migration 0064. */
  office_copy_email?: string | null;
  default_project_cover?: string | null;
}

interface CalendarConnection {
  googleCalendarId: string;
  connectedEmail: string | null;
  connectedAt: string;
  lastSyncedAt: string | null;
  lastSyncStatus: string | null;
  lastSyncError: string | null;
  scheduleCalendarId?: string | null;
  scheduleCalendarName?: string | null;
}

function NotificationHealthCard() {
  const [health, setHealth] = useState<{
    email: { apiKeySet: boolean; fromSet: boolean; from: string | null; alertRecipients: number };
    sms: { twilioSet: boolean; alertPhoneSet: boolean };
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/notification-health")
      .then((r) => r.json())
      .then((data) => setHealth(data.email ? data : null))
      .catch(() => setHealth(null));
  }, []);

  async function sendTest() {
    setTesting(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/notification-health", { method: "POST" });
      const data = await res.json();
      setResult(
        data.ok
          ? { ok: true, message: `Test sent to ${data.recipients.join(", ")}. Check those inboxes (and spam).` }
          : { ok: false, message: data.error || "The test email failed." }
      );
    } catch {
      setResult({ ok: false, message: "Something went wrong sending the test." });
    } finally {
      setTesting(false);
    }
  }

  const rows = health
    ? [
        { ok: health.email.apiKeySet, label: "Email service connected" },
        { ok: health.email.fromSet, label: health.email.from ? `Sending as ${health.email.from}` : "Sender address set" },
        { ok: health.email.alertRecipients > 0, label: `Alert emails go to ${health.email.alertRecipients} address${health.email.alertRecipients === 1 ? "" : "es"}` },
        { ok: health.sms.twilioSet && health.sms.alertPhoneSet, label: "Text alerts to your phone" }
      ]
    : [];

  return (
    <GlassCard className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-semibold">Email &amp; text alerts</p>
        <p className="text-xs text-muted">Client confirmations and new-submission alerts. If one ever fails, it shows up in your Notifications.</p>
      </div>
      {health === null ? (
        <p className="text-xs text-muted">Checking…</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <p key={r.label} className={`flex items-center gap-2 text-sm ${r.ok ? "" : "text-status-declined"}`}>
              <span className={`h-2 w-2 shrink-0 rounded-full ${r.ok ? "bg-status-approved" : "bg-status-declined"}`} />
              {r.label}
              {!r.ok && <span className="text-xs">— not set up</span>}
            </p>
          ))}
        </div>
      )}
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={sendTest} disabled={testing || health === null}>
          {testing ? "Sending…" : "Send test email"}
        </Button>
        {result && <span className={`text-xs ${result.ok ? "text-status-approved" : "text-status-declined"}`}>{result.message}</span>}
      </div>
    </GlassCard>
  );
}

function GoogleCalendarCard() {
  const searchParams = useSearchParams();
  const justConnected = searchParams.get("calendar") === "connected";
  const connectError = searchParams.get("calendar") === "error";
  const scopeError = searchParams.get("calendar") === "scope";

  const [connection, setConnection] = useState<CalendarConnection | null | undefined>(undefined);
  const [disconnecting, setDisconnecting] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [calendars, setCalendars] = useState<{ id: string; name: string; primary: boolean }[] | null>(null);
  const [calError, setCalError] = useState<string | null>(null);
  const [pick, setPick] = useState<string | null>(null);
  const [savingPick, setSavingPick] = useState(false);

  function loadCalendars() {
    fetch("/api/admin/calendar/calendars")
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || "Couldn't list your calendars.");
        setCalendars(d.calendars ?? []);
      })
      .catch((e) => setCalError(e instanceof Error ? e.message : "Couldn't list your calendars."));
  }

  async function saveSchedule() {
    setSavingPick(true);
    setPullNote(null);
    try {
      const res = await fetch("/api/admin/calendar", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ scheduleCalendarId: pick || null }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "Couldn't save that.");
      setPullNote({ ok: true, text: pick ? `Saved. ${d.pulled ?? 0} calendar entries read. Each DJ now sees the ones with their name.` : "Saved. No DJ schedule calendar is read now." });
      setPick(null);
      load();
    } catch (e) {
      setPullNote({ ok: false, text: e instanceof Error ? e.message : "Couldn't save that." });
    } finally {
      setSavingPick(false);
    }
  }
  const [pullNote, setPullNote] = useState<{ ok: boolean; text: string } | null>(null);

  async function handleFullPull() {
    setPulling(true);
    setPullNote(null);
    try {
      const res = await fetch("/api/admin/calendar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ full: true }) });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d.error || "The pull didn't finish.");
      setPullNote({ ok: true, text: `Done: ${d.pulled} calendar entries read. DJs now see their dates from the past year onward.` });
      load();
    } catch (e) {
      setPullNote({ ok: false, text: e instanceof Error ? e.message : "The pull didn't finish." });
    } finally {
      setPulling(false);
    }
  }

  function load() {
    fetch("/api/admin/calendar")
      .then((r) => r.json())
      .then((data) => setConnection(data.connection ?? null))
      .catch(() => setConnection(null));
  }

  useEffect(load, []);
  useEffect(() => {
    if (connection && calendars === null && !calError) loadCalendars();
  }, [connection, calendars, calError]);

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      await fetch("/api/admin/calendar", { method: "DELETE" });
      load();
    } finally {
      setDisconnecting(false);
    }
  }

  return (
    <GlassCard className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <CalendarDays size={18} className="shrink-0 text-gold" />
        <div className="flex-1">
          <p className="text-sm font-semibold">Google Calendar</p>
          <p className="text-xs text-muted">Two-way sync — confirmed bookings appear on your calendar, and your busy times block public booking slots.</p>
        </div>
      </div>

      {justConnected && <p className="text-xs text-status-approved">Connected — the next sync runs within 15 minutes.</p>}
      {connectError && <p className="text-xs text-status-declined">Something went wrong connecting to Google. Try again.</p>}
      {scopeError && (
        <p role="alert" className="text-xs text-status-declined">
          Google didn&apos;t give the CRM calendar access. Connect again, and on Google&apos;s screen tick the box for calendar access (&ldquo;See, edit, share, and permanently delete all the calendars…&rdquo;) before pressing Continue.
        </p>
      )}

      {connection === undefined && <p className="text-xs text-muted">Loading…</p>}

      {connection === null && (
        <a href="/api/admin/calendar/oauth/start">
          <Button variant="primary" size="sm">
            Connect Google Calendar
          </Button>
        </a>
      )}

      {connection && (
        <div className="flex flex-col gap-2 text-xs text-muted">
          <p>
            Connected as <span className="text-foreground">{connection.connectedEmail ?? "unknown account"}</span>
          </p>
          <p>
            {connection.lastSyncedAt
              ? `Last synced ${new Date(connection.lastSyncedAt).toLocaleString()}${connection.lastSyncStatus === "error" ? " — last run failed" : ""}`
              : "Not synced yet — first run within 15 minutes."}
          </p>
          {connection.lastSyncStatus === "error" && connection.lastSyncError && (
            <p className="text-status-declined">{/insufficient authentication scopes|ACCESS_TOKEN_SCOPE_INSUFFICIENT/.test(connection.lastSyncError) ? "Last sync failed: Google didn't give the CRM calendar access. Reconnect and tick the calendar access box." : connection.lastSyncError}</p>
          )}
          <p>
            Bookings go to: <span className="text-foreground">{connection.googleCalendarId === "primary" ? `the main calendar of ${connection.connectedEmail ?? "this account"}` : connection.googleCalendarId}</span>.
          </p>
          <div className="flex flex-col gap-1.5 rounded-[10px] border border-border p-3" data-tour="calendar-schedule-pick">
            <label htmlFor="schedule-cal" className="font-semibold text-foreground">
              DJ schedule calendar
            </label>
            <span>
              The calendar your DJs write their gigs on (like &ldquo;Young Wedding - Penny&rdquo;). Each DJ sees the entries with their name on their own Calendar page. It&apos;s only read, never changed, and doesn&apos;t block booking times.
            </span>
            {calError ? (
              <span role="alert" className="text-status-declined">{/invalid_grant|signed the CRM out/.test(calError) ? "Google signed the CRM out of this calendar, so the list of calendars can't load. Press Reconnect Google Calendar below and sign in again." : /403|insufficient/i.test(calError) ? "Google didn't give the CRM calendar access. Press Reconnect Google Calendar below, and on Google's screen tick the calendar access box before pressing Continue." : calError}</span>
            ) : calendars === null ? (
              <span>Loading your calendars…</span>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  id="schedule-cal"
                  value={pick ?? connection.scheduleCalendarId ?? ""}
                  onChange={(e) => setPick(e.target.value)}
                  className="min-w-0 max-w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm text-foreground focus:border-gold focus:outline-none"
                >
                  <option value="">None (only the main calendar)</option>
                  {calendars.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.primary ? " (main)" : ""}
                    </option>
                  ))}
                </select>
                <Button variant="primary" size="sm" onClick={saveSchedule} disabled={savingPick || pick === null || pick === (connection.scheduleCalendarId ?? "")}>
                  {savingPick ? "Reading the calendar…" : "Use this calendar"}
                </Button>
              </div>
            )}
            {!calError && calendars !== null && !connection.scheduleCalendarId && (
              <span className="text-status-declined">Not chosen yet, so DJs only see dates from the main calendar.</span>
            )}
          </div>
          <div className="flex flex-col gap-1" data-tour="calendar-full-pull">
            <Button variant="secondary" size="sm" onClick={handleFullPull} disabled={pulling} className="w-fit">
              {pulling ? "Pulling the calendar…" : "Pull the whole calendar again"}
            </Button>
            <span>Reads every entry from a year ago onward. Use it once after connecting, or if a DJ says a date is missing.</span>
            {pullNote && (
              <span role="status" className={pullNote.ok ? "text-status-approved" : "text-status-declined"}>
                {pullNote.text}
              </span>
            )}
          </div>
          {(/invalid_grant|signed the CRM out|403|insufficient/i.test(`${calError ?? ""} ${connection.lastSyncError ?? ""}`)) && (
            <a href="/api/admin/calendar/oauth/start" className="w-fit">
              <Button variant="primary" size="sm">Reconnect Google Calendar</Button>
            </a>
          )}
          <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="w-fit">
            {disconnecting ? "Disconnecting…" : "Disconnect"}
          </Button>
        </div>
      )}
    </GlassCard>
  );
}

function AdminSettingsPageInner() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [uploading, setUploading] = useState<"portal" | "admin" | "club" | null>(null);
  const [bannersDirty, setBannersDirty] = useState(false);
  const [copyDirty, setCopyDirty] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);

  const HERO_FIELD = { portal: ["portalHeroPhoto", "portal_hero_image_url"], admin: ["adminHeroPhoto", "admin_hero_image_url"], club: ["adminClubPhoto", "admin_club_image_url"] } as const;
  async function uploadHeroImage(surface: "portal" | "admin" | "club", file: File) {
    setUploading(surface);
    setError(null);
    try {
      const [field, column] = HERO_FIELD[surface];
      const form = new FormData();
      form.append(field, file);
      const res = await fetch("/api/admin/settings", { method: "PATCH", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(surface === "club" && /admin_club_image_url/.test(json.error ?? "") ? "Run migration 0063 in Supabase first to add the club photo." : json.error || "Failed to upload image");
      setSettings((s) => s && { ...s, [column]: json.settings[column] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(null);
    }
  }

  const [coverMsg, setCoverMsg] = useState<string | null>(null);
  async function setDefaultCover(src: string | null) {
    setCoverMsg(null);
    const before = settings?.default_project_cover ?? null;
    setSettings((s) => s && { ...s, default_project_cover: src });
    try {
      const res = await fetch("/api/admin/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ defaultProjectCover: src }) });
      const json = await res.json();
      if (!res.ok) throw new Error(/default_project_cover/.test(json.error ?? "") ? "Run migration 0066 in Supabase first to save a default photo." : json.error || "Couldn't save");
      setCoverMsg(src ? "Saved. Projects without their own photo now show this one." : "Saved. Projects without their own photo show the client portal banner.");
    } catch (err) {
      setSettings((s) => s && { ...s, default_project_cover: before });
      setCoverMsg(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  async function clearHeroImage(surface: "portal" | "admin" | "club") {
    setUploading(surface);
    setError(null);
    try {
      const column = HERO_FIELD[surface][1];
      const form = new FormData();
      form.append(`clear_${column}`, "true");
      const res = await fetch("/api/admin/settings", { method: "PATCH", body: form });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to remove image");
      setSettings((s) => s && { ...s, [column]: null });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUploading(null);
    }
  }

  async function generateHeroCopy(surface: "portal" | "admin", field: "heading" | "subheading") {
    const key = `${surface}-${field}`;
    setGenerating(key);
    setError(null);
    try {
      const res = await fetch("/api/admin/settings/generate-hero-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ surface, field })
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to generate copy");
      const column = `${surface}_hero_${field}` as "portal_hero_heading" | "portal_hero_subheading" | "admin_hero_heading" | "admin_hero_subheading";
      setSettings((s) => s && { ...s, [column]: json.text });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setGenerating(null);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/admin/settings");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load settings");
        setSettings(data.settings);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      }
    }
    load();
  }, []);

  async function handleSave() {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          allowDjSelfRegistration: settings.allow_dj_self_registration,
          requireDisclaimerAcceptance: settings.require_disclaimer_acceptance,
          crowdVoteBoostsEnabled: settings.crowd_vote_boosts_enabled,
          pushNotificationsEnabled: settings.push_notifications_enabled,
          portalHeroImageUrl: settings.portal_hero_image_url,
          portalHeroHeading: settings.portal_hero_heading,
          portalHeroSubheading: settings.portal_hero_subheading,
          portalHeroSettings: settings.portal_hero_settings,
          adminHeroImageUrl: settings.admin_hero_image_url,
          adminHeroHeading: settings.admin_hero_heading,
          adminHeroSubheading: settings.admin_hero_subheading,
          reviewUrl: settings.review_url,
          // Only sent once changed, so saving works before migration 0063 is run.
          ...(bannersDirty ? { adminDashboardBanners: settings.admin_dashboard_banners ?? null } : {}),
          ...(copyDirty ? { officeCopyEmail: settings.office_copy_email ?? "" } : {})
        }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          /office_copy_email/.test(data.error ?? "")
            ? "Run migration 0064 in Supabase to save the office copy address."
            : /admin_dashboard_banners/.test(data.error ?? "")
              ? "Run migration 0063 in Supabase to save banner crops."
              : data.error || "Failed to save settings"
        );
      setBannersDirty(false);
      setCopyDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader title="Platform Settings" subtitle="Global configuration for Digital Crate Requests." />
      <div className="flex flex-col gap-4 p-6">
        {error && <p className="text-xs text-status-declined">{error}</p>}

        <Link href="/admin/settings/permissions">
          <GlassCard className="flex items-center gap-3 transition-colors hover:border-gold/30">
            <ShieldCheck size={18} className="shrink-0 text-gold" />
            <div className="flex-1">
              <p className="text-sm font-semibold">Permissions</p>
              <p className="text-xs text-muted">Control what each role — owner, admin, DJ, client — can see and do.</p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-muted" />
          </GlassCard>
        </Link>

        <GlassCard className="flex flex-col gap-3" data-tour="site-theme-settings">
          <div>
            <p className="text-sm font-semibold">Site theme</p>
            <p className="text-xs text-muted">
              The look for the whole admin area: sidebar, pages and pop-ups. Saved in this browser. Project pages still open in their event type&apos;s look (change it there with Theme).
            </p>
          </div>
          <SiteThemeList />
          <div className="mt-1 border-t border-border pt-3" data-tour="dash-layout-settings">
            <p className="text-sm font-semibold">Dashboard layout</p>
            <p className="mb-2 text-xs text-muted">How the admin home is arranged. Colors come from the site theme above. Saved in this browser.</p>
            <DashLayoutList />
          </div>
        </GlassCard>

        <NotificationHealthCard />

        <GoogleCalendarCard />

        <PortalThemeSettings />

        <PlaybookTimingSettings />

        {!settings && !error && <p className="text-sm text-muted">Loading...</p>}

        {settings && (
          <>
            <GlassCard className="flex flex-col gap-4">
              <ToggleRow
                label="Allow new DJ self-registration with an invite code"
                checked={settings.allow_dj_self_registration}
                onChange={(v) => setSettings((s) => s && { ...s, allow_dj_self_registration: v })}
              />
              <ToggleRow
                label="Require disclaimer acceptance before paid requests"
                checked={settings.require_disclaimer_acceptance}
                onChange={(v) => setSettings((s) => s && { ...s, require_disclaimer_acceptance: v })}
              />
              <ToggleRow
                label="Enable Crowd Vote boosts platform-wide"
                checked={settings.crowd_vote_boosts_enabled}
                onChange={(v) => setSettings((s) => s && { ...s, crowd_vote_boosts_enabled: v })}
              />
            </GlassCard>

            <GlassCard className="flex flex-col gap-3" data-tour="office-copy">
              <div>
                <p className="text-sm font-semibold">Email copies</p>
                <p className="text-xs text-muted">
                  DJs email clients from their own mailbox. When the client is a Digital Crate DJs client (a website inquiry, or anyone the office added), a hidden copy goes to this address. Clients a DJ brought in through their own Leads aren&rsquo;t copied. Leave blank for no copies.
                </p>
              </div>
              <Field
                label="Office copy address"
                value={settings.office_copy_email ?? ""}
                onChange={(v) => {
                  setCopyDirty(true);
                  setSettings((s) => s && { ...s, office_copy_email: v || null });
                }}
                placeholder="bookings@digitalcratedjs.com"
              />
            </GlassCard>

            <GlassCard className="flex flex-col gap-3">
              <div>
                <p className="text-sm font-semibold">Reviews</p>
                <p className="text-xs text-muted">Used by the &ldquo;Post-Event Review Request&rdquo; automation (Library → Automations) — it&rsquo;s seeded off by default until you set this and confirm the email copy.</p>
              </div>
              <Field
                label="Review link"
                value={settings.review_url ?? ""}
                onChange={(v) => setSettings((s) => s && { ...s, review_url: v || null })}
                placeholder="Your Google Business / The Knot / WeddingWire review link"
              />
            </GlassCard>

            <GlassCard className="flex flex-col gap-4" data-tour="default-project-cover">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ImageIcon size={18} className="shrink-0 text-gold" />
                  <div>
                    <p className="text-sm font-semibold">Default project photo</p>
                    <p className="text-xs text-muted">The banner on each client&apos;s project page when the project has no photo of its own. Any project can pick a different one under Customize Portal.</p>
                  </div>
                </div>
                {settings.default_project_cover && (
                  <Button variant="text" size="sm" onClick={() => setDefaultCover(null)}>
                    Use none
                  </Button>
                )}
              </div>
              <CoverPicker value={settings.default_project_cover ?? null} onPick={(src) => setDefaultCover(src)} label="Default project photo" />
              {coverMsg && <p role="status" className="text-xs text-muted">{coverMsg}</p>}
            </GlassCard>

            <GlassCard className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <ImageIcon size={18} className="shrink-0 text-gold" />
                <div>
                  <p className="text-sm font-semibold">Branding — Hero Banners</p>
                  <p className="text-xs text-muted">Optional banners at the top of the client portal home and the admin dashboard. Leave blank to show nothing.</p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Client Portal</p>
                  <HeroImageUpload
                    imageUrl={settings.portal_hero_image_url}
                    uploading={uploading === "portal"}
                    onUpload={(f) => uploadHeroImage("portal", f)}
                    onClear={() => clearHeroImage("portal")}
                  />
                  <CopyFieldWithAI
                    label="Heading"
                    value={settings.portal_hero_heading ?? ""}
                    placeholder={`e.g. "${HERO_COPY_EXAMPLES.portal.heading}"`}
                    onChange={(v) => setSettings((s) => s && { ...s, portal_hero_heading: v || null })}
                    onGenerate={() => generateHeroCopy("portal", "heading")}
                    generating={generating === "portal-heading"}
                  />
                  <CopyFieldWithAI
                    label="Subheading"
                    value={settings.portal_hero_subheading ?? ""}
                    placeholder={`e.g. "${HERO_COPY_EXAMPLES.portal.subheading}"`}
                    onChange={(v) => setSettings((s) => s && { ...s, portal_hero_subheading: v || null })}
                    onGenerate={() => generateHeroCopy("portal", "subheading")}
                    generating={generating === "portal-subheading"}
                  />
                  <HeroBanner imageUrl={settings.portal_hero_image_url} heading={settings.portal_hero_heading} subheading={settings.portal_hero_subheading} />
                  {settings.portal_hero_image_url && (
                    <HeroCropControls
                      photoUrl={settings.portal_hero_image_url}
                      settings={mergeHeroSettings(settings.portal_hero_settings)}
                      onChange={(v) => setSettings((s) => s && { ...s, portal_hero_settings: v })}
                      previewLabel="Default Portal Hero"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted">Admin Dashboard</p>
                  <HeroImageUpload
                    imageUrl={settings.admin_hero_image_url}
                    uploading={uploading === "admin"}
                    onUpload={(f) => uploadHeroImage("admin", f)}
                    onClear={() => clearHeroImage("admin")}
                  />
                  <CopyFieldWithAI
                    label="Heading"
                    value={settings.admin_hero_heading ?? ""}
                    placeholder={`e.g. "${HERO_COPY_EXAMPLES.admin.heading}"`}
                    onChange={(v) => setSettings((s) => s && { ...s, admin_hero_heading: v || null })}
                    onGenerate={() => generateHeroCopy("admin", "heading")}
                    generating={generating === "admin-heading"}
                  />
                  <CopyFieldWithAI
                    label="Subheading"
                    value={settings.admin_hero_subheading ?? ""}
                    placeholder={`e.g. "${HERO_COPY_EXAMPLES.admin.subheading}"`}
                    onChange={(v) => setSettings((s) => s && { ...s, admin_hero_subheading: v || null })}
                    onGenerate={() => generateHeroCopy("admin", "subheading")}
                    generating={generating === "admin-subheading"}
                  />
                  <HeroBanner imageUrl={settings.admin_hero_image_url} heading={settings.admin_hero_heading} subheading={settings.admin_hero_subheading} />
                  <p className="text-[11px] text-muted">
                    This photo is the Weddings banner in the Modern Studio layout and the hero in Midnight Command. With no photo, both use a built-in wedding photo.
                  </p>
                  {settings.admin_hero_image_url && (
                    <HeroCropControls
                      photoUrl={settings.admin_hero_image_url}
                      settings={mergeHeroSettings({ xPosition: 50, yPosition: 50, ...settings.admin_dashboard_banners?.wedding, zoom: 100, overlayDarkness: 0 })}
                      onChange={(v) => {
                        setBannersDirty(true);
                        setSettings((s) => s && { ...s, admin_dashboard_banners: { ...s.admin_dashboard_banners, wedding: { xPosition: v.xPosition, yPosition: v.yPosition } } });
                      }}
                      previewLabel="Dashboard banner focus"
                      previewHeightClass="h-[120px]"
                      positionOnly
                    />
                  )}
                  <div className="mt-2 border-t border-border pt-3" data-tour="dash-club-photo">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted">Club &amp; Bar Nights photo</p>
                    <p className="mb-2 text-[11px] text-muted">The second banner in Modern Studio. With no photo it uses a built-in club photo.</p>
                    <HeroImageUpload
                      imageUrl={settings.admin_club_image_url ?? null}
                      uploading={uploading === "club"}
                      onUpload={(f) => uploadHeroImage("club", f)}
                      onClear={() => clearHeroImage("club")}
                    />
                    {settings.admin_club_image_url && (
                      <div className="mt-3">
                        <HeroCropControls
                          photoUrl={settings.admin_club_image_url}
                          settings={mergeHeroSettings({ xPosition: 50, yPosition: 50, ...settings.admin_dashboard_banners?.club, zoom: 100, overlayDarkness: 0 })}
                          onChange={(v) => {
                            setBannersDirty(true);
                            setSettings((s) => s && { ...s, admin_dashboard_banners: { ...s.admin_dashboard_banners, club: { xPosition: v.xPosition, yPosition: v.yPosition } } });
                          }}
                          previewLabel="Dashboard banner focus"
                          previewHeightClass="h-[120px]"
                          positionOnly
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>

            <div className="flex items-center gap-3">
              <Button variant="primary" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </Button>
              {saved && <span className="text-xs text-status-approved">Saved</span>}
            </div>
          </>
        )}
      </div>
    </>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm text-muted">Loading...</div>}>
      <AdminSettingsPageInner />
    </Suspense>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <ToggleSwitch checked={checked} onChange={onChange} label={label} />
    </div>
  );
}
