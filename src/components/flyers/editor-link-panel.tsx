"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, Link2, Loader2, RefreshCw, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Issue } from "@/lib/flyers/links";
import { FOCUS, iconBtn, inputCls } from "./editor-panels";
import type { LinkData, LinkProps } from "./flyer-editor";

const label = "mb-1 block text-[11px] font-semibold uppercase tracking-wide text-muted";
const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", timeZone: "America/Chicago" }) : "No date");

/**
 * The flyer's links: which event (and through it the venue and DJs) its
 * linked layers follow, which DJ fills each slot, the template, and the
 * night's drink specials. Changing these never edits the event itself.
 */
export function EventPanel({
  link,
  data,
  busy,
  staff,
  slotsUsed,
  onChange,
  onRefresh
}: {
  link: LinkProps;
  data: LinkData;
  busy: boolean;
  staff: boolean;
  slotsUsed: number;
  onChange: (b: { eventId?: string | null; venueId?: string | null; djSlots?: (string | null)[] | null }) => void;
  onRefresh: () => void;
}) {
  const venues = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of link.events) if (e.venue_id) m.set(e.venue_id, e.venue_name ?? "Venue");
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [link.events]);
  const [venueFilter, setVenueFilter] = useState<string>("");
  const events = link.events.filter((e) => !venueFilter || e.venue_id === venueFilter);
  const slotCount = Math.max(slotsUsed, data.slots.length, 1);
  // Staff: anyone. A DJ: the event's DJs. Whoever is in a slot now is always listed.
  const pickable = [...(staff ? link.allDjs : data.eventDjs), ...data.djs].filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i).map((d) => ({ id: d.id, display_name: d.display_name }));
  const [tpl, setTpl] = useState("");
  const [tplBusy, setTplBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!link.ready)
    return (
      <p className="m-3 rounded-[10px] bg-status-pending/10 p-3 text-xs text-status-pending">
        Linking flyers to events needs migration 0052_flyer_event_links.sql in Supabase. Once it&apos;s run, pick the event here.
      </p>
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Event */}
      <section className="flex flex-col gap-2">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <CalendarDays size={15} className="text-gold-dim" /> Event
        </p>
        {venues.length > 1 && (
          <label className="block">
            <span className={label}>Venue</span>
            <select className={inputCls} value={venueFilter} onChange={(e) => setVenueFilter(e.target.value)}>
              <option value="">All venues</option>
              {venues.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="block">
          <span className={label}>Linked event</span>
          <select className={inputCls} value={data.event?.id ?? ""} disabled={busy} onChange={(e) => onChange({ eventId: e.target.value || null })}>
            <option value="">No event (type the details yourself)</option>
            {data.event && !events.some((e) => e.id === data.event!.id) && <option value={data.event.id}>{[fmt(data.event.starts_at), data.event.title, data.event.venue_name].filter(Boolean).join(" · ")}</option>}
            {events.map((e) => (
              <option key={e.id} value={e.id}>
                {[fmt(e.starts_at), e.title, e.venue_name].filter(Boolean).join(" · ")}
              </option>
            ))}
          </select>
        </label>
        {data.event ? (
          <p className="text-xs text-muted">
            Venue: <b className="text-foreground">{data.venue?.name ?? "none set on the event"}</b>
            {data.venue && !data.venue.has_logo && " (no logo uploaded)"}
          </p>
        ) : (
          <p className="text-xs text-muted">Linked text shows labels until an event is picked.</p>
        )}
        <button className={cn(iconBtn, "self-start")} disabled={busy || !data.event} onClick={onRefresh}>
          {busy ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />} Refresh from event
        </button>
      </section>

      {/* DJ slots */}
      <section className="flex flex-col gap-2 border-t border-black/8 pt-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Users size={15} className="text-gold-dim" /> DJs
        </p>
        {Array.from({ length: slotCount }, (_, i) => {
          const id = data.slots[i] ?? "";
          const dj = data.djs.find((d) => d.id === id);
          return (
            <div key={i}>
              <label className="block">
                <span className={label}>DJ slot {i + 1}{i === 0 ? " (lead)" : ""}</span>
                <select
                  className={inputCls}
                  value={id}
                  disabled={busy}
                  onChange={(e) => {
                    const next = Array.from({ length: slotCount }, (_, j) => data.slots[j] ?? null);
                    next[i] = e.target.value || null;
                    onChange({ djSlots: next });
                  }}
                >
                  <option value="">Nobody</option>
                  {pickable.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.display_name}
                      {data.eventDjs.some((x) => x.id === d.id) ? " (on this event)" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {dj && (
                <p className="mt-1 text-[11px] text-muted">
                  {dj.has_cutout ? "Approved cutout" : dj.has_photo ? "Profile photo (no approved cutout)" : "⚠ No photo"} · {dj.has_logo ? "Name logo" : "No name logo: name shown as text"}
                </p>
              )}
            </div>
          );
        })}
        {!staff && <p className="text-[11px] text-muted">Only DJs on this event can be picked.</p>}
      </section>

      {/* Drink specials */}
      <SpecialsBox eventId={data.event?.id ?? null} specials={data.drinkSpecials} venueName={data.venue?.name ?? null} canEdit={staff} onSaved={onRefresh} />

      {/* Template */}
      <section className="flex flex-col gap-2 border-t border-black/8 pt-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold">
          <Link2 size={15} className="text-gold-dim" /> Template
        </p>
        <p className="text-xs text-muted">
          Using <b className="text-foreground">{link.templates.find((t) => t.id === link.currentTemplateId)?.name ?? "a template"}</b>
          {link.activeTemplate.templateId && link.activeTemplate.via !== "latest" && link.activeTemplate.templateId !== link.currentTemplateId && (
            <>
              {" "}
              · active for this {link.activeTemplate.via === "event" ? "event" : link.activeTemplate.via === "venue" ? "venue" : "company"}:{" "}
              <b className="text-foreground">{link.templates.find((t) => t.id === link.activeTemplate.templateId)?.name ?? "another template"}</b>
            </>
          )}
        </p>
        <div className="flex gap-1.5">
          <select className={inputCls} value={tpl} onChange={(e) => setTpl(e.target.value)} aria-label="Switch template">
            <option value="">Switch to another template…</option>
            {link.templates
              .filter((t) => t.id !== link.currentTemplateId)
              .map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.id === link.activeTemplate.templateId ? " (active)" : ""}
                </option>
              ))}
          </select>
          <button
            className={iconBtn}
            disabled={!tpl || tplBusy}
            onClick={async () => {
              if (!window.confirm("Use this template's layout for this flyer? Your overrides carry over; layout changes you made here are replaced.")) return;
              setTplBusy(true);
              setErr(await link.applyTemplate(tpl));
              setTplBusy(false);
            }}
          >
            {tplBusy ? <Loader2 size={14} className="animate-spin" /> : "Apply"}
          </button>
        </div>
        {err && <p className="text-xs text-status-declined">{err}</p>}
      </section>
    </div>
  );
}

function SpecialsBox({ eventId, specials, venueName, canEdit, onSaved }: { eventId: string | null; specials: LinkData["drinkSpecials"]; venueName: string | null; canEdit: boolean; onSaved: () => void }) {
  const [night, setNight] = useState<string>("");
  const [venueDefault, setVenueDefault] = useState<string>("");
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    if (!canEdit || !eventId) return;
    let live = true;
    fetch(`/api/flyers/specials?event=${eventId}`)
      .then((r) => r.json())
      .then((j) => {
        if (!live) return;
        setNight(j.night ?? "");
        setVenueDefault(j.venueDefault ?? "");
        setLoaded(true);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [canEdit, eventId]);
  async function save(scope: "night" | "venue", text: string) {
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/flyers/specials", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, scope, text }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setMsg(j.error ?? "Couldn't save.");
    setMsg("Saved.");
    onSaved();
  }
  return (
    <section className="flex flex-col gap-2 border-t border-black/8 pt-3">
      <p className="text-sm font-semibold">Drink specials</p>
      {!eventId ? (
        <p className="text-xs text-muted">Pick an event to use its drink specials.</p>
      ) : specials.text ? (
        <p className="whitespace-pre-line rounded-[8px] bg-black/[0.04] p-2 text-xs">
          {specials.text}
          <span className="mt-1 block text-[10px] uppercase tracking-wide text-muted">{specials.from === "night" ? "This night's specials" : `${venueName ?? "Venue"} default`}</span>
        </p>
      ) : (
        <p className="text-xs text-muted">None for this night. Specials layers hide themselves when empty.</p>
      )}
      {canEdit && eventId && loaded && (
        <details className="text-xs">
          <summary className={cn("cursor-pointer font-medium text-gold-dim", FOCUS)}>Edit specials</summary>
          <label className="mt-2 block">
            <span className={label}>This night (overrides the venue default)</span>
            <textarea className={cn(inputCls, "min-h-[70px]")} value={night} maxLength={600} onChange={(e) => setNight(e.target.value)} />
          </label>
          <button className={cn(iconBtn, "mt-1")} disabled={busy} onClick={() => void save("night", night)}>
            Save for this night
          </button>
          <label className="mt-3 block">
            <span className={label}>{venueName ?? "Venue"} default</span>
            <textarea className={cn(inputCls, "min-h-[70px]")} value={venueDefault} maxLength={600} onChange={(e) => setVenueDefault(e.target.value)} />
          </label>
          <button className={cn(iconBtn, "mt-1")} disabled={busy} onClick={() => void save("venue", venueDefault)}>
            Save venue default
          </button>
          {msg && <p className="mt-1 text-[11px] text-muted">{msg}</p>}
          <p className="mt-1 text-[11px] text-muted">Venues edit their nights&apos; specials in their portal too; it&apos;s the same list.</p>
        </details>
      )}
    </section>
  );
}

/** Problems found before export. Export is still possible after reviewing them. */
export function IssuesDialog({ issues, onPick, onCancel, onExport }: { issues: Issue[]; onPick: (id: string) => void; onCancel: () => void; onExport: () => void }) {
  const errors = issues.filter((i) => i.level === "error").length;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="issues-title" onClick={onCancel}>
      <div className="w-full max-w-md rounded-[16px] bg-[var(--card)] p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <p id="issues-title" className="flex items-center gap-2 text-base font-semibold">
          <AlertTriangle size={18} className="text-status-pending" /> Check before exporting
        </p>
        <p className="mt-1 text-xs text-muted">{errors ? "Some content is missing or doesn't fit." : "A few things to look at."} Warnings and placeholder boxes never appear in the exported image.</p>
        <ul className="mt-3 flex max-h-[50vh] flex-col gap-1.5 overflow-y-auto">
          {issues.map((i, k) => (
            <li key={k}>
              <button className={cn("flex w-full items-start gap-2 rounded-[8px] px-2 py-1.5 text-left text-sm hover:bg-black/[0.04]", FOCUS)} onClick={() => i.nodeId && onPick(i.nodeId)} disabled={!i.nodeId}>
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", i.level === "error" ? "bg-status-declined" : "bg-status-pending")} />
                {i.message}
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 flex justify-end gap-2">
          <button autoFocus className={iconBtn} onClick={onCancel}>
            Fix first
          </button>
          <button className={cn(iconBtn, "border-gold bg-gold font-semibold text-[#1a140b]")} onClick={onExport}>
            Export anyway
          </button>
        </div>
      </div>
    </div>
  );
}
