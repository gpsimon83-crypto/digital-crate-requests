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
  "venue.updated": "Updated venue settings",
  "venue.cover_uploaded": "Uploaded a cover photo",
  "venue.logo_uploaded": "Uploaded a logo",
  "manager.invited": "Invited a manager",
  "manager.link_created": "Created a setup link",
  "manager.activated": "Turned on manager access",
  "manager.deactivated": "Turned off manager access",
  "manager.removed": "Removed a manager"
};

function Card({ title, hint, children, className }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-card border border-border bg-card p-5 shadow-card", className)}>
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

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/venues/${venueId}/portal`);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Couldn't load this venue.");
      return;
    }
    setVenue(data.venue);
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
    if (!res.ok) throw new Error(data.error || "Couldn't save.");
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
        calendar_names: venue.calendar_names
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
            target="_blank"
            className="inline-flex items-center gap-1.5 rounded-[10px] border border-black/10 px-3 py-1.5 text-xs hover:border-gold"
          >
            <ExternalLink size={13} /> Preview as venue
          </Link>
        </div>

        {error && <p className="rounded-[10px] border border-status-declined/40 bg-status-declined/10 p-3 text-xs text-status-declined">{error}</p>}

        <Card title="Access">
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

        <CalendarNamesCard names={venue.calendar_names} onChange={(n) => edit({ calendar_names: n })} />

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
    <Card title="Recurring entertainment nights" hint="The venue's regular DJ nights, shown on their dashboard.">
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

function CalendarNamesCard({ names, onChange }: { names: string[]; onChange: (n: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const t = draft.trim();
    if (t && !names.some((n) => n.toLowerCase() === t.toLowerCase())) onChange([...names, t]);
    setDraft("");
  };
  return (
    <Card
      title="Names on the DCDJ calendar"
      hint="How this venue is written in the shared Google Calendar (e.g. “Casey Keys”, “CK Fri”). Used later to show the venue its bar nights from the members-area schedule. Never shown to the venue."
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
        {!names.length && <span className="text-xs text-muted">None yet.</span>}
      </div>
      <div className="mt-3 flex max-w-md gap-2">
        <input
          className={inputCls}
          value={draft}
          placeholder="Add a name"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
        <Button variant="secondary" onClick={add}>
          Add
        </Button>
      </div>
    </Card>
  );
}

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
      if (data.link) setLink({ email: data.manager.email, url: data.link });
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
      setCopied(false);
      await onChanged();
    } catch (err) {
      onError(err instanceof Error ? err.message : "Couldn't create a link.");
    }
  }

  return (
    <Card title="Venue managers" hint="People at the venue who can sign in. Each manager only sees the venues they're added to.">
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
