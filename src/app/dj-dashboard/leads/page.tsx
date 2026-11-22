"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CalendarDays, Check, Inbox, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { GlassCard } from "@/components/ui/glass-card";
import { EVENT_TYPES } from "@/lib/event-types";
import { cn } from "@/lib/utils";

interface Lead {
  id: string;
  title: string;
  status: string;
  starts_at: string | null;
  created_at: string;
  event_type: string | null;
  venue_name?: string | null;
  clients: { company_name: string | null; first_name: string | null; last_name: string | null } | null;
}

const input = "w-full rounded-[10px] border border-black/10 bg-panel px-4 py-2.5 text-sm focus:border-gold focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40";
const label = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted";
const empty = { name: "", email: "", phone: "", eventDate: "", eventType: "Wedding", venueName: "", expectedGuests: "", message: "" };

/**
 * A DJ's leads: client inquiries they're assigned, and a form to add one
 * they found themselves. Added leads go to the office like a website
 * inquiry, already assigned to this DJ.
 */
function LeadsPage() {
  const params = useSearchParams();
  const [leads, setLeads] = useState<Lead[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [open, setOpen] = useState(params.get("new") === "1");
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);

  function load() {
    Promise.all([fetch("/api/me").then((r) => r.json()), fetch("/api/admin/events").then(async (r) => ({ ok: r.ok, data: await r.json() }))])
      .then(([me, ev]) => {
        if (!ev.ok) throw new Error(ev.data.error || "Couldn't load your leads");
        const mine = (ev.data.events ?? []).filter((e: Lead & { dj_id: string | null }) => e.status === "inquiry" && (!me?.dj?.id || e.dj_id === me.dj.id));
        setLeads(mine.sort((a: Lead, b: Lead) => (a.starts_at ?? "").localeCompare(b.starts_at ?? "")));
      })
      .catch((err) => {
        setLoadError(err instanceof Error ? err.message : "Something went wrong.");
        setLeads([]);
      });
  }
  useEffect(load, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/dj/leads", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Couldn't add the lead");
      setAdded(form.name);
      setForm(empty);
      setOpen(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const who = (l: Lead) => l.clients?.company_name || [l.clients?.first_name, l.clients?.last_name].filter(Boolean).join(" ") || "Client";

  return (
    <>
      <PageHeader
        title="Leads"
        subtitle="Clients interested in booking you. Add one you found yourself and the office takes it from there: quote, contract and payment."
        action={
          !open ? (
            <button type="button" onClick={() => setOpen(true)} className="flex items-center gap-1.5 rounded-[10px] bg-gold px-4 py-2 text-sm font-semibold text-[var(--on-gold,#1a140a)] hover:brightness-105" data-tour="dj-add-lead">
              <Plus size={15} /> Add a lead
            </button>
          ) : undefined
        }
      />
      <div className="mx-auto flex max-w-4xl flex-col gap-4 p-4 sm:p-6">
        {added && (
          <p role="status" className="flex items-center gap-2 rounded-[12px] border border-status-approved/40 bg-status-approved/10 px-4 py-3 text-sm">
            <Check size={16} className="text-status-approved" /> Lead for {added} added. The office has been told, and it&apos;s on your list below.
          </p>
        )}
        {open && (
          <GlassCard className="flex flex-col gap-4" data-tour="dj-lead-form">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">New lead</p>
                <p className="text-xs text-muted">Who they are and what they&apos;re planning. It&apos;s assigned to you.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-muted hover:text-foreground" aria-label="Close the form">
                <X size={16} />
              </button>
            </div>
            <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className={label}>Client name *</span>
                <input required value={form.name} onChange={set("name")} className={input} autoComplete="off" />
              </label>
              <label className="block">
                <span className={label}>Client email *</span>
                <input required type="email" value={form.email} onChange={set("email")} className={input} autoComplete="off" />
              </label>
              <label className="block">
                <span className={label}>Phone</span>
                <input type="tel" value={form.phone} onChange={set("phone")} className={input} autoComplete="off" />
              </label>
              <label className="block">
                <span className={label}>Event date *</span>
                <input required type="date" value={form.eventDate} onChange={set("eventDate")} className={input} />
              </label>
              <label className="block">
                <span className={label}>Event type</span>
                <select value={form.eventType} onChange={set("eventType")} className={input}>
                  {EVENT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={label}>Guests (about)</span>
                <input type="number" min={1} value={form.expectedGuests} onChange={set("expectedGuests")} className={input} />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Venue</span>
                <input value={form.venueName} onChange={set("venueName")} className={input} placeholder="Where it is, if they know" />
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>Notes</span>
                <textarea value={form.message} onChange={set("message")} rows={3} className={cn(input, "resize-y")} placeholder="Budget, hours, music, how you met them…" />
              </label>
              {error && <p className="text-xs text-status-declined sm:col-span-2">{error}</p>}
              <div className="flex gap-2 sm:col-span-2">
                <button type="submit" disabled={saving} className="rounded-[10px] bg-gold px-5 py-2.5 text-sm font-semibold text-[var(--on-gold,#1a140a)] disabled:opacity-60">
                  {saving ? "Adding…" : "Add lead"}
                </button>
                <button type="button" onClick={() => setOpen(false)} className="rounded-[10px] border border-border px-4 py-2.5 text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </GlassCard>
        )}

        <section aria-labelledby="leads-list">
          <h2 id="leads-list" className="mb-2 text-xs font-semibold uppercase tracking-[1.5px] text-muted">
            Open leads {leads ? `(${leads.length})` : ""}
          </h2>
          {leads === null ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : loadError ? (
            <p role="alert" className="text-sm text-status-declined">{loadError}</p>
          ) : leads.length === 0 ? (
            <GlassCard className="flex flex-col items-center gap-2 py-10 text-center">
              <Inbox size={22} className="text-gold/70" />
              <p className="text-sm text-muted">No open leads. Add one when someone asks about booking you.</p>
            </GlassCard>
          ) : (
            <ul className="flex flex-col gap-2">
              {leads.map((l) => (
                <li key={l.id}>
                  <Link href={`/dj-dashboard/projects/${l.id}`} className="flex items-center gap-3 rounded-[14px] border border-border bg-card p-3 hover:border-gold">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-soft text-gold" aria-hidden>
                      <CalendarDays size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{who(l)}</span>
                      <span className="block truncate text-xs text-muted">
                        {l.event_type ?? "Event"}
                        {l.starts_at ? ` · ${new Date(l.starts_at).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}` : ""}
                        {l.venue_name ? ` · ${l.venue_name}` : ""}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full border border-dashed border-border px-2.5 py-0.5 text-xs font-semibold text-muted">Inquiry</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[11px] text-muted">Once the office confirms a lead it moves to your Bookings.</p>
        </section>
      </div>
    </>
  );
}

export default function DjLeadsPage() {
  return (
    <Suspense fallback={null}>
      <LeadsPage />
    </Suspense>
  );
}
