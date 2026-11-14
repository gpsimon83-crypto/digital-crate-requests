"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, ExternalLink, ImagePlus, Plus, Trash2, UserPlus, X } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { Button } from "@/components/ui/button";
import { ToggleSwitch } from "@/components/ui/toggle-switch";
import { ConfirmModal } from "@/components/ui/confirm-modal";
import { VenueBanner } from "./venue-banner";
import { DAY_NAMES, type CoverFocus, type RecurringNight, type VenueManager, type VenueRecord } from "@/lib/venue/types";
import { cn } from "@/lib/utils";
import { isDjName, venueSearchNames, VENUE_CALENDAR_OPTIONS } from "@/lib/venue/calendar-options";
import { MAX_LOCATIONS, type VenueLocation } from "@/lib/venue/locations";

interface LogRow {
  id: string;
  actor_label: string | null;
  action: string;
  detail: Record<string, unknown>;
  created_at: string;
}

const inputCls = "w-full rounded-[10px] border border-black/10 bg-panel px-3 py-2 text-sm focus:border-gold focus:outline-none";
const labelCls = "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted";

const ACTION_LABELS: Record<string, string> = {
  "night_plan.saved": "Venue saved drink specials / DJ request",
  "night_plan.cleared": "Venue removed a night plan",
  "venue.updated": "Updated venue settings",
  "venue.cover_uploaded": "Uploaded a cover photo",
  "venue.logo_uploaded": "Uploaded a logo",
  "manager.invited": "Invited a manager",
  "manager.link_created": "Created a setup link",
  "manager.activated": "Turned on manager access",
  "manager.deactivated": "Turned off manager access",
  "manager.removed": "Removed a manager"
};

function Card({ title, hint, children, className, tour }: { title: string; hint?: string; children: React.ReactNode; className?: string; tour?: string }) {
  return (
    <section data-tour={tour} className={cn("rounded-card border border-border bg-card p-5 shadow-card", className)}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className={labelCls}>{label}</span>
      {children}
    </label>
  );
}

export function VenueAdmin({ venueId }: { venueId: string }) {
  const [venue, setVenue] = useState<VenueRecord | null>(null);
  const [managers, setManagers] = useState<VenueManager[]>([]);
  const [log, setLog] = useState<LogRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [locations, setLocations] = useState<VenueLocation[]>([]);
  const [locationsReady, setLocationsReady] = useState(true);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/venues/${venueId}/portal`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Couldn't load this venue.");
      return;
    }
    setVenue(data.venue);
    setLocations(data.locations ?? []);
    setLocationsReady(data.locationsReady !== false);
    setManagers(data.managers);
    setLog(data.log);
    setDirty(false);
  }, [venueId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function edit(patch: Partial<VenueRecord>) {
    setVenue((v) => (v ? { ...v, ...patch } : v));
    setDirty(true);
  }

  async function patch(body: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/admin/venues/${venueId}/portal`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (data.locations) setLocations(data.locations);
    if (!res.ok) {
      if (data.venue) setVenue(data.venue);
      throw new Error(data.error || "Couldn't save.");
    }
    return data.venue as VenueRecord;
  }

  async function save() {
    if (!venue) return;
    setSaving(true);
    try {
      const v = await patch({
        name: venue.name,
        slug: venue.slug,
        location: venue.location,
        address_line1: venue.address_line1,
        city: venue.city,
        state: venue.state,
        postal_code: venue.postal_code,
        contact_name: venue.contact_name,
        contact_phone: venue.contact_phone,
        dcdjs_contact_name: venue.dcdjs_contact_name,
        dcdjs_contact_email: venue.dcdjs_contact_email,
        dcdjs_contact_phone: venue.dcdjs_contact_phone,
        cover_focus: venue.cover_focus,
        recurring_nights: venue.recurring_nights,
        scheduling_prefs: venue.scheduling_prefs,
        calendar_names: venue.calendar_names,
        ...(locationsReady ? { locations } : {})
      });
      setVenue(v);
      setDirty(false);
      setSavedAt(Date.now());
      void refreshLog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function refreshLog() {
    const res = await fetch(`/api/admin/venues/${venueId}/portal`);
    if (res.ok) {
      const data = await res.json();
      setLog(data.log);
      setManagers(data.managers);
    }
  }

  async function toggle(field: "is_active" | "portal_enabled", value: boolean) {
    if (!venue) return;
    const before = venue[field];
    setVenue({ ...venue, [field]: value });
    try {
      await patch({ [field]: value });
      void refreshLog();
    } catch (err) {
      setVenue((v) => (v ? { ...v, [field]: before } : v));
      setError(err instanceof Error ? err.message : "Couldn't save.");
    }
  }

  if (error && !venue) {
    return (
      <div className="p-6">
        <p className="text-sm text-status-declined">{error}</p>
        <Link href="/admin/venues" className="mt-3 inline-block text-xs text-gold-dim hover:underline">
          Back to venues
        </Link>
      </div>
    );
  }
  if (!venue) return <div className="p-6 text-sm text-muted">Loading venue…</div>;

  return (
    <>
      <PageHeader title={venue.name} subtitle="Venue Partner Portal settings" />
      <div className="mx-auto flex max-w-6xl flex-col gap-5 p-4 pb-28 sm:p-6 sm:pb-28">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin/venues" className="inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
            <ArrowLeft size={14} /> All venues
          </Link>
          <span className="flex-1" />
          <Link
            href={`/venue?venue=${venue.id}`}
            data-tour="venue-preview"
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-black/10 px-3 py-1.5 text-xs hover:border-gold"
          >
            <ExternalLink size={13} /> Preview as venue
          </Link>
        </div>

        {error && <p className="rounded-[10px] border border-status-declined/40 bg-status-declined/10 p-3 text-xs text-status-declined">{error}</p>}

        <Card title="Access" tour="venue-access">
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
            <div className="flex items-center gap-3">
              <ToggleSwitch checked={venue.is_active} onChange={(v) => toggle("is_active", v)} label="Venue active" />
              <div>
                <p className="text-sm font-medium">Venue active</p>
                <p className="text-xs text-muted">Turning this off blocks every manager at this venue.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <ToggleSwitch checked={venue.portal_enabled} onChange={(v) => toggle("portal_enabled", v)} label="Portal on" />
              <div>
                <p className="text-sm font-medium">Portal on</p>
                <p className="text-xs text-muted">Managers can only sign in once this is on.</p>
              </div>
            </div>
          </div>
        </Card>

        <BrandingCard venue={venue} venueId={venueId} onChange={edit} onUploaded={(patchV) => { setVenue((v) => (v ? { ...v, ...patchV } : v)); void refreshLog(); }} onError={setError} />

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Venue details">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Venue name" className="sm:col-span-2">
                <input className={inputCls} value={venue.name} onChange={(e) => edit({ name: e.target.value })} />
              </Field>
              <Field label="Street address" className="sm:col-span-2">
                <input className={inputCls} value={venue.address_line1 ?? ""} onChange={(e) => edit({ address_line1: e.target.value })} />
              </Field>
              <Field label="City">
                <input className={inputCls} value={venue.city ?? ""} onChange={(e) => edit({ city: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="State">
                  <input className={inputCls} value={venue.state ?? ""} onChange={(e) => edit({ state: e.target.value })} />
                </Field>
                <Field label="ZIP">
                  <input className={inputCls} value={venue.postal_code ?? ""} onChange={(e) => edit({ postal_code: e.target.value })} />
                </Field>
              </div>
              <Field label="Venue contact">
                <input className={inputCls} value={venue.contact_name ?? ""} onChange={(e) => edit({ contact_name: e.target.value })} />
              </Field>
              <Field label="Venue phone">
                <input className={inputCls} value={venue.contact_phone ?? ""} onChange={(e) => edit({ contact_phone: e.target.value })} />
              </Field>
            </div>
          </Card>

          <Card title="DCDJs contact person" hint="Shown to the venue as their point of contact at Digital Crate DJs.">
            <div className="grid gap-3">
              <Field label="Name">
                <input className={inputCls} value={venue.dcdjs_contact_name ?? ""} onChange={(e) => edit({ dcdjs_contact_name: e.target.value })} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Email">
                  <input type="email" className={inputCls} value={venue.dcdjs_contact_email ?? ""} onChange={(e) => edit({ dcdjs_contact_email: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <input className={inputCls} value={venue.dcdjs_contact_phone ?? ""} onChange={(e) => edit({ dcdjs_contact_phone: e.target.value })} />
                </Field>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid gap-5 lg:grid-cols-2">
          <NightsCard nights={venue.recurring_nights} onChange={(n) => edit({ recurring_nights: n })} />
          <Card title="Scheduling preferences">
            <div className="grid gap-3">
              <Field label="Music and crowd notes">
                <textarea
                  rows={3}
                  className={inputCls}
                  value={venue.scheduling_prefs.music_notes ?? ""}
                  onChange={(e) => edit({ scheduling_prefs: { ...venue.scheduling_prefs, music_notes: e.target.value } })}
                />
              </Field>
              <Field label="Setup / load-in notes">
                <textarea
                  rows={2}
                  className={inputCls}
                  value={venue.scheduling_prefs.setup_notes ?? ""}
                  onChange={(e) => edit({ scheduling_prefs: { ...venue.scheduling_prefs, setup_notes: e.target.value } })}
                />
              </Field>
              <Field label="Request extra dates at least (days ahead)">
                <input
                  type="number"
                  min={0}
                  max={365}
                  className={cn(inputCls, "max-w-[140px]")}
                  value={venue.scheduling_prefs.request_lead_days ?? ""}
                  onChange={(e) =>
                    edit({ scheduling_prefs: { ...venue.scheduling_prefs, request_lead_days: e.target.value === "" ? undefined : Number(e.target.value) } })
                  }
                />
              </Field>
            </div>
          </Card>
        </div>

        <CalendarNamesCard venueId={venue.id} venueName={venue.name} names={venue.calendar_names} onChange={(n) => edit({ calendar_names: n })} />

        <LocationsCard
          ready={locationsReady}
          venueName={venue.name}
          locations={locations}
          onChange={(l) => {
            setLocations(l);
            setDirty(true);
          }}
        />

        <NightPlansCard venueId={venueId} />

        <ManagersCard venueId={venueId} managers={managers} onChanged={refreshLog} onError={setError} />

        <Card title="Activity" hint="Every change to this venue's portal, newest first.">
          {log.length ? (
            <ul className="divide-y divide-border text-sm">
              {log.map((l) => (
                <li key={l.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <span>
                    {ACTION_LABELS[l.action] ?? l.action}
                    {typeof l.detail?.email === "string" && <span className="text-muted"> · {l.detail.email}</span>}
                  </span>
                  <span className="text-xs text-muted">
                    {l.actor_label ?? "System"} · {new Date(l.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No changes yet.</p>
          )}
        </Card>
      </div>

      <div
        className={cn(
          "fixed inset-x-0 bottom-16 z-30 border-t md:bottom-0 border-border bg-card/95 px-4 py-3 backdrop-blur transition-transform md:left-16",
          dirty ? "translate-y-0" : "pointer-events-none translate-y-[200%] opacity-0"
        )}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
          <span className="text-xs text-muted">You have unsaved changes.</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => void load()} disabled={saving}>
              Discard
            </Button>
            <Button variant="primary" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      </div>
      {savedAt && !dirty && <SavedToast key={savedAt} />}
    </>
  );
}

function SavedToast() {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 2500);
    return () => clearTimeout(t);
  }, []);
  if (!show) return null;
  return <div className="fixed bottom-5 left-1/2 z-40 -translate-x-1/2 rounded-full bg-foreground px-4 py-2 text-xs text-background shadow-card">Saved</div>;
}

/* ---------------- Branding ---------------- */

function BrandingCard({
  venue,
  venueId,
  onChange,
  onUploaded,
  onError
}: {
  venue: VenueRecord;
  venueId: string;
  onChange: (p: Partial<VenueRecord>) => void;
  onUploaded: (p: Partial<VenueRecord>) => void;
  onError: (e: string) => void;
}) {
  const [busy, setBusy] = useState<"cover" | "logo" | null>(null);
  const [crop, setCrop] = useState<"desktop" | "mobile">("desktop");
  const coverRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  async function upload(kind: "cover" | "logo", file: File | undefined) {
    if (!file) return;
    setBusy(kind);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      const res = await fetch(`/api/admin/venues/${venueId}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed.");
      onUploaded(kind === "cover" ? { cover_url: data.url } : { logo_url: data.url });
    } catch (err) {
      onError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(null);
    }
  }

  function setFocus(which: "desktop" | "mobile", x: number, y: number) {
    const focus: CoverFocus = { ...venue.cover_focus, [which]: { x: Math.round(x), y: Math.round(y) } };
    onChange({ cover_focus: focus });
  }

  const subtitle = [venue.city, venue.state].filter(Boolean).join(", ") || venue.location;
  const f = venue.cover_focus[crop];

  return (
    <Card
      tour="venue-branding"
      title="Branding"
      hint="Cover photo: 1600 × 400 or larger works best (JPG, PNG or WebP, up to 8 MB). The venue name and logo are placed on top, so don't put text in the photo."
    >
      <div className="flex flex-wrap gap-2">
        <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { void upload("cover", e.target.files?.[0]); e.target.value = ""; }} />
        <input ref={logoRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { void upload("logo", e.target.files?.[0]); e.target.value = ""; }} />
        <Button variant="secondary" onClick={() => coverRef.current?.click()} disabled={!!busy}>
          <ImagePlus size={14} /> {busy === "cover" ? "Uploading…" : venue.cover_url ? "Replace cover photo" : "Upload cover photo"}
        </Button>
        <Button variant="secondary" onClick={() => logoRef.current?.click()} disabled={!!busy}>
          <ImagePlus size={14} /> {busy === "logo" ? "Uploading…" : venue.logo_url ? "Replace logo" : "Upload logo"}
        </Button>
        {venue.logo_url && (
          <Button variant="text" onClick={() => onChange({ logo_url: null })}>
            Remove logo
          </Button>
        )}
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_300px]">
        <div className="flex flex-col gap-4">
          <div>
            <p className={labelCls}>Desktop (1600 × 400)</p>
            <FocusPicker active={crop === "desktop"} onPick={(x, y) => { setCrop("desktop"); setFocus("desktop", x, y); }}>
              <VenueBanner force="desktop" name={venue.name} subtitle={subtitle} logoUrl={venue.logo_url} coverUrl={venue.cover_url} focus={venue.cover_focus} />
            </FocusPicker>
          </div>
          <div className="max-w-[380px]">
            <p className={labelCls}>Phone (1080 × 320)</p>
            <FocusPicker active={crop === "mobile"} onPick={(x, y) => { setCrop("mobile"); setFocus("mobile", x, y); }}>
              <VenueBanner force="mobile" name={venue.name} subtitle={subtitle} logoUrl={venue.logo_url} coverUrl={venue.cover_url} focus={venue.cover_focus} />
            </FocusPicker>
          </div>
        </div>
        <div className="rounded-[12px] border border-border bg-panel p-4">
          <div className="flex gap-1 rounded-full border border-border bg-card p-1 text-xs" role="tablist" aria-label="Crop to adjust">
            {(["desktop", "mobile"] as const).map((c) => (
              <button key={c} role="tab" aria-selected={crop === c} onClick={() => setCrop(c)} className={cn("flex-1 rounded-full px-3 py-1", crop === c ? "bg-gold-soft font-medium" : "text-muted")}>
                {c === "desktop" ? "Desktop crop" : "Phone crop"}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted">Click the part of the photo you want centered, or fine-tune with the sliders.</p>
          <Slider label="Left ↔ right" value={f.x} onChange={(x) => setFocus(crop, x, f.y)} />
          <Slider label="Top ↕ bottom" value={f.y} onChange={(y) => setFocus(crop, f.x, y)} />
          <button className="mt-3 text-xs text-gold-dim hover:underline" onClick={() => setFocus(crop, 50, 50)}>
            Reset to center
          </button>
        </div>
      </div>
    </Card>
  );
}

function FocusPicker({ active, onPick, children }: { active: boolean; onPick: (x: number, y: number) => void; children: React.ReactNode }) {
  return (
    <div
      className={cn("cursor-crosshair rounded-[16px] p-0.5", active ? "ring-2 ring-gold" : "ring-1 ring-transparent")}
      onClick={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        onPick(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
      }}
    >
      {children}
    </div>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="mt-3 block">
      <span className="flex justify-between text-xs">
        <span>{label}</span>
        <span className="text-muted">{value}%</span>
      </span>
      <input type="range" min={0} max={100} value={value} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 w-full accent-gold" />
    </label>
  );
}

/* ---------------- Entertainment nights ---------------- */

function NightsCard({ nights, onChange }: { nights: RecurringNight[]; onChange: (n: RecurringNight[]) => void }) {
  const set = (i: number, p: Partial<RecurringNight>) => onChange(nights.map((n, j) => (j === i ? { ...n, ...p } : n)));
  return (
    <Card tour="venue-nights" title="Recurring entertainment nights" hint="The venue's regular DJ nights, shown on their dashboard.">
      <div className="flex flex-col gap-3">
        {nights.map((n, i) => (
          <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-[10px] border border-border p-3 sm:grid-cols-[130px_1fr_100px_100px_auto] sm:items-end sm:border-0 sm:p-0">
            <Field label="Day">
              <select className={inputCls} value={n.day} onChange={(e) => set(i, { day: Number(e.target.value) })}>
                {DAY_NAMES.map((d, k) => (
                  <option key={d} value={k}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Name" className="col-span-2 sm:col-span-1">
              <input className={inputCls} value={n.label} placeholder="e.g. Friday Night Party" onChange={(e) => set(i, { label: e.target.value })} />
            </Field>
            <Field label="Start">
              <input type="time" className={inputCls} value={n.start} onChange={(e) => set(i, { start: e.target.value })} />
            </Field>
            <Field label="End">
              <input type="time" className={inputCls} value={n.end} onChange={(e) => set(i, { end: e.target.value })} />
            </Field>
            <button
              className="self-end rounded-[10px] p-2 text-muted hover:text-status-declined sm:mb-0.5"
              onClick={() => onChange(nights.filter((_, j) => j !== i))}
              aria-label="Remove night"
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <Button variant="secondary" className="self-start" onClick={() => onChange([...nights, { day: 5, label: "", start: "21:00", end: "01:00" }])}>
          <Plus size={14} /> Add a night
        </Button>
      </div>
    </Card>
  );
}

/* ---------------- Calendar names ---------------- */

type CalendarCheck = {
  names: string[];
  ignored: string[];
  month: string;
  reason: string;
  http: number | null;
  count: number;
  sample: { date: string; matched: string; dj: string | null; dj_text: string; state: string }[];
  byLocation?: { name: string; count: number }[];
};

const CHECK_HELP: Record<string, string> = {
  "no-names": "This venue has no saved calendar name yet. Choose one above and click Save changes, then test again.",
  "no-key": "The CRM's partner key (INQUIRY_PARTNER_SECRET in Vercel) isn't set, so it can't ask the website.",
  "key-mismatch": "The website refused the CRM's key. INQUIRY_PARTNER_SECRET in Vercel and DC_CRM_PARTNER_KEY in wp-config.php must be exactly the same value.",
  "site-key-missing": "The website has no DC_CRM_PARTNER_KEY in wp-config.php (or it's shorter than 32 characters).",
  "site-not-updated": "The website doesn't have the venue feed yet (the theme update hasn't reached the server).",
  "site-calendar-error": "The website couldn't read the DCDJ Google Calendar just now. Check Settings → Google Calendar Integration on the website.",
  "site-unreachable": "The CRM couldn't reach the website (no answer). It may have been down or blocking the request.",
  "no-matches": "The link works, but no nights this month or the next two mention this venue's calendar name. Check the spelling against the calendar."
};

function CalendarCheckButton({ venueId }: { venueId: string }) {
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<CalendarCheck | null>(null);
  const [err, setErr] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/admin/venues/${venueId}/calendar-check`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Check failed.");
      setRes(d);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Check failed.");
    } finally {
      setBusy(false);
    }
  }
  const fmt = (d: string) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return (
    <div className="mt-4 border-t border-border pt-3">
      <Button variant="secondary" disabled={busy} onClick={run}>
        {busy ? "Testing…" : "Test calendar link"}
      </Button>
      <span className="ml-2 text-xs text-muted">Uses the saved names. Save changes first.</span>
      {err && <p className="mt-2 text-xs text-status-declined">{err}</p>}
      {res && (
        <div className={cn("mt-3 rounded-[10px] border p-3 text-xs", res.reason ? "border-status-pending/40 bg-status-pending/10" : "border-status-confirmed/40 bg-status-confirmed/10")}>
          {res.reason ? (
            <p>
              <b>Not working yet:</b> {CHECK_HELP[res.reason] ?? `The website answered with an error (${res.http ?? "no answer"}).`}
            </p>
          ) : (
            <>
              <p>
                <b>Working.</b> Found {res.count} night{res.count === 1 ? "" : "s"} from {res.month} on for {res.names.join(", ")}:
              </p>
              {!!res.byLocation?.length && (
                <p className="mt-1">
                  By location: {res.byLocation.filter((b) => b.name !== "No location" || b.count > 0).map((b) => `${b.name} ${b.count}`).join(" · ")}
                  {res.byLocation.some((b) => b.name === "No location" && b.count > 0) && " (add those calendar names to a location, or mark one location as the default)"}
                </p>
              )}
              <ul className="mt-2 space-y-1">
                {res.sample.map((s, i) => (
                  <li key={i}>
                    {fmt(s.date)} · {s.dj ?? (s.dj_text || "DJ not set")} {s.state === "confirmed" ? "(confirmed)" : ""}
                  </li>
                ))}
              </ul>
            </>
          )}
          <p className="mt-2 text-muted">
            Searched for: {res.names.length ? res.names.join(", ") : "nothing"}
            {res.ignored?.length ? ` · skipped DJ names: ${res.ignored.join(", ")}` : ""} · website answer: {res.http ?? "not asked"}
          </p>
        </div>
      )}
    </div>
  );
}

function CalendarNamesCard({ venueId, venueName, names, onChange }: { venueId: string; venueName: string; names: string[]; onChange: (n: string[]) => void }) {
  const djChips = names.filter((n) => isDjName(n, []));
  const searching = venueSearchNames(venueName, names, []);
  const [pick, setPick] = useState("");
  const [other, setOther] = useState("");
  const has = (t: string) => names.some((n) => n.toLowerCase() === t.toLowerCase());
  const add = (t: string) => {
    const v = t.trim();
    if (v && !has(v)) onChange([...names, v]);
    setPick("");
    setOther("");
  };
  const options = VENUE_CALENDAR_OPTIONS.filter((o) => !has(o));
  return (
    <Card
      tour="venue-calendar-names"
      title="Name on the DCDJ calendar"
      hint="Pick how this venue is written on the shared DCDJ Google Calendar. Every calendar night that mentions it (like “Casey Key / Que”) shows on this venue’s portal with the DJ’s actual name from Venue Portals → DJs on the DCDJ calendar. Venues only see the date, time and DJ."
    >
      <div className="flex flex-wrap gap-2">
        {names.map((n) => (
          <span key={n} className="inline-flex items-center gap-1 rounded-full border border-border bg-panel px-3 py-1 text-xs">
            {n}
            <button onClick={() => onChange(names.filter((x) => x !== n))} aria-label={`Remove ${n}`} className="text-muted hover:text-status-declined">
              <X size={12} />
            </button>
          </span>
        ))}
        {!names.length && <span className="text-xs text-muted">Optional: the venue&apos;s own name is always searched. Add another spelling below if the calendar writes it differently.</span>}
      </div>
      <p className="mt-2 text-xs text-muted">
        Searching the calendar for: <b className="text-text">{searching.join(", ")}</b>
      </p>
      {djChips.length > 0 && (
        <div className="mt-2 rounded-[10px] border border-status-pending/40 bg-status-pending/10 p-3 text-xs">
          <p>
            <b>These are DJ names, so they&apos;re skipped here:</b> {djChips.join(", ")}. DJs belong in Venue Portals → DJs on the DCDJ calendar,
            which already sets their real names on every venue.
          </p>
          <Button variant="secondary" className="mt-2" onClick={() => onChange(names.filter((n) => !isDjName(n, [])))}>
            Remove DJ names from this box
          </Button>
        </div>
      )}
      <div className="mt-3 flex max-w-lg flex-col gap-2 sm:flex-row">
        <select
          className={inputCls}
          value={pick}
          aria-label="Name on the DCDJ calendar"
          onChange={(e) => {
            const v = e.target.value;
            if (v && v !== OTHER_NAME) add(v);
            else setPick(v);
          }}
        >
          <option value="">Choose the calendar name…</option>
          {options.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
          <option value={OTHER_NAME}>Other…</option>
        </select>
        {pick === OTHER_NAME && (
          <>
            <input
              className={inputCls}
              value={other}
              maxLength={80}
              placeholder="As written on the calendar"
              onChange={(e) => setOther(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  add(other);
                }
              }}
            />
            <Button variant="secondary" onClick={() => add(other)}>
              Add
            </Button>
          </>
        )}
      </div>
      <CalendarCheckButton venueId={venueId} />
    </Card>
  );
}

const OTHER_NAME = "__other__";

/* ---------------- Managers ---------------- */

function ManagersCard({
  venueId,
  managers,
  onChanged,
  onError
}: {
  venueId: string;
  managers: VenueManager[];
  onChanged: () => Promise<void> | void;
  onError: (e: string) => void;
}) {
  const [form, setForm] = useState({ full_name: "", email: "", title: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ email: string; url: string } | null>(null);
  const [existing, setExisting] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  async function call(method: string, body?: Record<string, unknown>, qs = "") {
    const res = await fetch(`/api/admin/venues/${venueId}/managers${qs}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Something went wrong.");
    return data;
  }

  async function invite() {
    setBusy(true);
    try {
      const data = await call("POST", form);
      setForm({ full_name: "", email: "", title: "", phone: "" });
      setExisting(data.existingLogin ? data.manager.email : null);
      setLink(data.link ? { email: data.manager.email, url: data.link } : null);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't invite.");
    } finally {
      setBusy(false);
    }
  }

  async function newLink(m: VenueManager) {
    try {
      const data = await call("POST", { action: "link", managerId: m.id });
      setLink({ email: m.email, url: data.link });
      setExisting(null);
      setCopied(false);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't create a link.");
    }
  }

  return (
    <Card tour="venue-managers" title="Venue managers" hint="People at the venue who can sign in. Each manager only sees the venues they're added to.">
      {managers.length ? (
        <ul className="divide-y divide-border">
          {managers.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {m.full_name || m.email}
                  {m.title && <span className="font-normal text-muted"> · {m.title}</span>}
                </p>
                <p className="text-xs text-muted">
                  {m.email} · {m.last_seen_at ? `Last signed in ${new Date(m.last_seen_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Hasn't signed in yet"}
                </p>
              </div>
              <button className="text-xs text-gold-dim hover:underline" onClick={() => void newLink(m)}>
                Get setup link
              </button>
              <span className="flex items-center gap-2 text-xs">
                <ToggleSwitch
                  checked={m.is_active}
                  label="Access"
                  onChange={async (v) => {
                    try {
                      await call("PATCH", { managerId: m.id, is_active: v });
                      await onChanged();
                    } catch (err) {
                      onError(err instanceof Error ? err.message : "Couldn't update.");
                    }
                  }}
                />
                {m.is_active ? "Access on" : "Access off"}
              </span>
              <button className="p-1 text-muted hover:text-status-declined" onClick={() => setRemoveId(m.id)} aria-label={`Remove ${m.email}`}>
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">No managers yet.</p>
      )}

      {existing && (
        <div className="mt-4 rounded-[12px] border border-gold/40 bg-gold-soft/50 p-4">
          <p className="text-sm font-medium">{existing} already has a Digital Crate DJs login</p>
          <p className="mt-1 text-xs text-muted">
            They&apos;re now connected to this venue and keep their current access. Tell them to sign in at <b>cratesdjs.com/venue/login</b> with the password
            they already use. If they don&apos;t remember it, click &quot;Get setup link&quot; next to their name and send them that link to set a new one.
          </p>
        </div>
      )}

      {link && (
        <div className="mt-4 rounded-[12px] border border-gold/40 bg-gold-soft/50 p-4">
          <p className="text-sm font-medium">Setup link for {link.email}</p>
          <p className="mt-1 text-xs text-muted">
            Send this to the manager yourself (text or email). It lets them set a password once, then takes them to the venue portal. Nothing was emailed automatically. If it expires, click &quot;Get setup link&quot; again.
          </p>
          <div className="mt-2 flex gap-2">
            <input readOnly value={link.url} className={cn(inputCls, "font-mono text-[11px]")} onFocus={(e) => e.target.select()} />
            <Button
              variant="primary"
              onClick={async () => {
                await navigator.clipboard.writeText(link.url);
                setCopied(true);
              }}
            >
              <Copy size={14} /> {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
      )}

      <div className="mt-5 border-t border-border pt-4">
        <p className="mb-3 flex items-center gap-2 text-sm font-medium">
          <UserPlus size={15} /> Add a manager
        </p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Name">
            <input className={inputCls} value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
          </Field>
          <Field label="Email">
            <input type="email" className={inputCls} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </Field>
          <Field label="Title">
            <input className={inputCls} value={form.title} placeholder="e.g. General Manager" onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </Field>
          <Field label="Phone">
            <input className={inputCls} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </Field>
        </div>
        <Button variant="primary" className="mt-3" onClick={() => void invite()} disabled={busy || !form.email.trim()}>
          {busy ? "Adding…" : "Add manager and get setup link"}
        </Button>
      </div>

      <ConfirmModal
        open={!!removeId}
        title="Remove this manager?"
        body="They'll lose access to this venue right away. Their login stays in case they manage another venue."
        confirmLabel="Remove"
        onConfirm={async () => {
          const id = removeId;
          setRemoveId(null);
          try {
            await call("DELETE", undefined, `?managerId=${encodeURIComponent(id ?? "")}`);
            await onChanged();
          } catch (err) {
            onError(err instanceof Error ? err.message : "Couldn't remove.");
          }
        }}
        onCancel={() => setRemoveId(null)}
      />
    </Card>
  );
}

type NightPlanRow = {
  date: string;
  occasion: string | null;
  drink_specials: string | null;
  dj_request_name: string | null;
  dj_request_note: string | null;
  dj_requested_at: string | null;
};

/** What the venue added in its portal: drink specials per night and DJ requests (requests, not bookings). */
function NightPlansCard({ venueId }: { venueId: string }) {
  const [plans, setPlans] = useState<NightPlanRow[] | null>(null);
  const [ready, setReady] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/admin/venues/${venueId}/night-plans`)
      .then(async (r) => {
        const d = await r.json();
        if (!live) return;
        if (!r.ok) setErr(d.error || "Couldn't load.");
        setPlans(d.plans ?? []);
        setReady(d.ready !== false);
      })
      .catch(() => live && setErr("Couldn't load."));
    return () => {
      live = false;
    };
  }, [venueId]);
  const day = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  return (
    <Card title="From the venue: drink specials & DJ requests" hint="Added by the venue in its portal. DJ requests are preferences, not bookings: confirm or follow up with the venue.">
      {!ready ? (
        <p className="text-sm text-muted">Not switched on yet: run supabase/migrations/0048_venue_night_plans.sql in the Supabase SQL editor.</p>
      ) : err ? (
        <p className="text-sm text-red-400">{err}</p>
      ) : !plans ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : plans.length ? (
        <ul className="divide-y divide-border text-sm">
          {plans.map((p) => (
            <li key={p.date} className="grid gap-1 py-2.5 sm:grid-cols-[110px_1fr]">
              <span className="font-medium">{day(p.date)}</span>
              <div className="min-w-0">
                {p.occasion && <p className="font-medium">{p.occasion}</p>}
                {(p.dj_request_name || p.dj_request_note) && (
                  <p>
                    <span className="mr-1.5 rounded-full border border-gold/40 bg-gold/10 px-2 py-px text-[11px] text-gold">DJ request</span>
                    {p.dj_request_name ?? "Any available DJ"}
                    {p.dj_request_note ? <span className="text-muted"> · {p.dj_request_note}</span> : null}
                  </p>
                )}
                {p.drink_specials && <p className="whitespace-pre-line text-muted">Specials: {p.drink_specials}</p>}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">Nothing from the venue yet.</p>
      )}
    </Card>
  );
}

/**
 * Several places under one venue (e.g. North 48 Cedarburg and North 48 Oconomowoc).
 * Each location lists how it's written on the DCDJ calendar; the portal shows the
 * locations side by side with the DJs booked at each.
 */
function LocationsCard({ ready, venueName, locations, onChange }: { ready: boolean; venueName: string; locations: VenueLocation[]; onChange: (l: VenueLocation[]) => void }) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const update = (i: number, patch: Partial<VenueLocation>) => onChange(locations.map((l, j) => (j === i ? { ...l, ...patch } : patch.is_default ? { ...l, is_default: false } : l)));
  const addName = (i: number) => {
    const key = locations[i].id;
    const v = (drafts[key] ?? "").trim();
    if (v.length < 2 || locations[i].calendar_names.some((c) => c.toLowerCase() === v.toLowerCase())) return;
    update(i, { calendar_names: [...locations[i].calendar_names, v].slice(0, 8) });
    setDrafts((d) => ({ ...d, [key]: "" }));
  };
  const add = () => onChange([...locations, { id: `loc_new${Date.now().toString(36)}`, name: "", city: null, calendar_names: [], is_default: false }].slice(0, MAX_LOCATIONS));
  return (
    <Card
      title="Locations"
      hint={`Use this when ${venueName} has more than one place (e.g. Cedarburg and Oconomowoc). The portal then shows each location side by side with the DJs booked there. Leave empty for a single location.`}
    >
      {!ready ? (
        <p className="text-sm text-muted">Needs a one-time database update: run supabase/migrations/0049_venue_locations.sql in the Supabase SQL editor, then reload this page.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {locations.map((l, i) => (
            <div key={l.id} className="rounded-[12px] border border-border p-3">
              <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                <Field label="Location name">
                  <input className={inputCls} value={l.name} maxLength={60} placeholder="Oconomowoc" onChange={(e) => update(i, { name: e.target.value })} />
                </Field>
                <Field label="City (shown to the venue)">
                  <input className={inputCls} value={l.city ?? ""} maxLength={60} placeholder="Oconomowoc, WI" onChange={(e) => update(i, { city: e.target.value || null })} />
                </Field>
                <button type="button" onClick={() => onChange(locations.filter((_, j) => j !== i))} className="inline-flex min-h-10 items-center gap-1 rounded-[10px] px-3 text-xs text-status-declined hover:bg-status-declined/10">
                  <Trash2 size={14} /> Remove
                </button>
              </div>
              <div className="mt-3">
                <span className={labelCls}>How this location is written on the DCDJ calendar</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {l.calendar_names.map((c) => (
                    <span key={c} className="inline-flex items-center gap-1 rounded-full border border-gold/40 bg-gold/10 px-2.5 py-1 text-xs">
                      {c}
                      <button type="button" aria-label={`Remove ${c}`} onClick={() => update(i, { calendar_names: l.calendar_names.filter((x) => x !== c) })} className="text-muted hover:text-foreground">
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                  <input
                    className={cn(inputCls, "w-auto min-w-[200px] flex-1")}
                    value={drafts[l.id] ?? ""}
                    placeholder={`e.g. ${venueName} ${l.name || "Ocon"}`}
                    maxLength={80}
                    onChange={(e) => setDrafts((d) => ({ ...d, [l.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addName(i);
                      }
                    }}
                  />
                  <Button variant="secondary" size="sm" onClick={() => addName(i)}>
                    <Plus size={14} /> Add
                  </Button>
                </div>
                <p className="mt-1 text-[11px] text-muted">Type it the way it appears in calendar titles. Include the venue name (&quot;{venueName} {l.name || "Ocon"}&quot;) so other venues in the same town don&apos;t match.</p>
              </div>
              <label className="mt-2 flex items-center gap-2 text-xs">
                <input type="radio" name="default-location" checked={l.is_default} onChange={() => update(i, { is_default: true })} />
                Nights that just say &quot;{venueName}&quot; (no location in the title) belong here
              </label>
            </div>
          ))}
          {locations.length < MAX_LOCATIONS && (
            <Button variant="secondary" onClick={add} className="w-fit">
              <Plus size={14} /> Add location
            </Button>
          )}
          {locations.length > 0 && <p className="text-xs text-muted">Click Save changes at the top, then Test calendar link to see how many nights each location gets.</p>}
        </div>
      )}
    </Card>
  );
}
