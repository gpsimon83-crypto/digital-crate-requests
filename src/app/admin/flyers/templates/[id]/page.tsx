"use client";

import { BADGE_SAMPLES } from "@/lib/flyers/scene";
import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { FlyerEditorClient } from "@/components/flyers/client";
import { iconBtn, inputCls, type Asset, type VenueOpt } from "@/components/flyers/editor-panels";
import type { SaveResult, Scenes } from "@/components/flyers/flyer-editor";
import { cn } from "@/lib/utils";
import { FORMAT_KEYS, type PlaceholderValues, type TemplateContent } from "@/lib/flyers/types";

type Loaded = {
  template: { id: string; name: string; description: string | null; venue_id: string | null; status: string; current_version_id: string | null; draft: TemplateContent; updated_at: string };
  versions: { id: string; version: number; published_at: string }[];
  shared: Asset[];
  venues: VenueOpt[];
  djs: { id: string; display_name: string; has_photo: boolean }[];
};

const SAMPLE = { dj_name: "DJ Name", event_title: "Saturday Night", event_date: "Saturday, November 22", start_time: "9 PM", end_time: "2 AM", venue_name: "Venue Name", venue_address: "123 Main St, Milwaukee, WI", drink_specials: "$5 Margaritas\n$3 Domestic bottles", event_details: "Birthday bash", dj2_name: "DJ Two", dj_lineup: "DJ Name • DJ Two", event_year: "2026", venue_street: "123 Main St", venue_city: "Milwaukee, WI 53202", ...BADGE_SAMPLES};

export default function TemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string>("");
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // Preview with a real booking / venue night (or just a venue) and chosen DJs. Display only: never saved into the template.
  type PEvent = { id: string; title: string | null; starts_at: string | null; venue_id: string | null; venue_name: string | null; dj_id: string | null; source: "event" | "calendar"; dj_name?: string | null };
  const [pEvents, setPEvents] = useState<PEvent[]>([]);
  const [pWith, setPWith] = useState("");
  const [pDj1, setPDj1] = useState("");
  const [pDj2, setPDj2] = useState("");
  const [preview, setPreview] = useState<{ values: PlaceholderValues; slots: (string | null)[]; venueId: string | null } | null>(null);
  const [pBusy, setPBusy] = useState(false);
  useEffect(() => {
    fetch("/api/admin/flyers/preview")
      .then((r) => (r.ok ? r.json() : { events: [] }))
      .then((j) => setPEvents(j.events ?? []))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    let live = true;
    const qs = new URLSearchParams();
    if (pWith.startsWith("venue:")) qs.set("venue", pWith.slice(6));
    else if (pWith) qs.set("event", pWith);
    if (pDj1) qs.set("dj1", pDj1);
    if (pDj2) qs.set("dj2", pDj2);
    if (![...qs.keys()].length) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreview(null);
      return;
    }
    if (!qs.has("event") && !qs.has("venue")) {
      // DJs only: no event or venue values, just who fills the slots.
      setPreview({ values: {}, slots: [pDj1 || null, pDj2 || null], venueId: null });
      return;
    }
    setPBusy(true);
    fetch(`/api/admin/flyers/preview?${qs}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!live) return;
        setPBusy(false);
        if (j) setPreview({ values: j.values ?? {}, slots: j.slots ?? [], venueId: j.venueId ?? null });
      })
      .catch(() => live && setPBusy(false));
    return () => {
      live = false;
    };
  }, [pWith, pDj1, pDj2]);
  const flush = useRef<(() => Promise<boolean>) | null>(null);
  const onSaveReady = useCallback((fn: () => Promise<boolean>) => {
    flush.current = fn;
  }, []);

  useEffect(() => {
    fetch(`/api/admin/flyers/templates/${id}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Couldn't open this template.");
        setData(j);
        setVenueId(j.template.venue_id ?? "");
      })
      .catch((e) => setError(e.message));
  }, [id]);

  const save = useCallback(
    async (scenes: Scenes, name: string): Promise<SaveResult> => {
      try {
        const r = await fetch(`/api/admin/flyers/templates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: { formats: scenes }, name }) });
        const j = await r.json().catch(() => ({}));
        return r.ok ? { ok: true } : { ok: false, error: j.error ?? "Couldn't save." };
      } catch {
        return { ok: false, error: "You're offline." };
      }
    },
    [id]
  );

  async function publish() {
    setPublishing(true);
    setMsg(null);
    const saved = (await flush.current?.()) ?? true;
    if (!saved) {
      setPublishing(false);
      return setMsg("Save failed, so nothing was published.");
    }
    const r = await fetch(`/api/admin/flyers/templates/${id}/publish`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setPublishing(false);
    if (!r.ok) return setMsg(j.error ?? "Couldn't publish.");
    setData((d) => (d ? { ...d, template: { ...d.template, status: "published", current_version_id: j.version.id }, versions: [j.version, ...d.versions] } : d));
    setMsg(`Published version ${j.version.version}. Flyers already started keep their version.`);
  }

  async function setVenue(v: string) {
    setVenueId(v);
    await fetch(`/api/admin/flyers/templates/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ venueId: v || null }) });
  }

  if (error)
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="text-sm text-status-declined">{error}</p>
          <Link href="/admin/flyers" className="mt-3 inline-block text-sm text-gold underline">
            Back to templates
          </Link>
        </div>
      </div>
    );
  if (!data) return <div className="grid h-dvh place-items-center text-sm text-muted">Opening template…</div>;

  const t = data.template;
  const first = FORMAT_KEYS.find((k) => t.draft.formats[k]) ?? "portrait";
  const latest = data.versions[0];
  return (
    // Full screen above the admin chrome: the editor needs the whole window.
    <div className="fixed inset-0 z-[60] bg-background">
      <FlyerEditorClient
        mode="template"
        templateId={id}
        title={t.name}
        scenes={t.draft.formats}
        format={first}
        staff
        owner={null}
        uploads={[]}
        shared={data.shared}
        venues={data.venues}
        previewDjs={data.djs}
        sampleValues={SAMPLE}
        preview={preview}
        previewBar={
          <span className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Preview with" data-tour="flyer-preview-with">
            <span className="text-muted">Preview with</span>
            <select className={cn(inputCls, "w-auto max-w-[220px] py-1 text-xs")} aria-label="Preview with a booking, venue night or venue" value={pWith} onChange={(e) => setPWith(e.target.value)}>
              <option value="">Sample wording</option>
              <optgroup label="Venue (no date)">
                {data.venues.map((v) => (
                  <option key={v.id} value={`venue:${v.id}`}>
                    {v.name}
                  </option>
                ))}
              </optgroup>
              {(
                [
                  ["Bookings", pEvents.filter((e) => e.source !== "calendar")],
                  ["Venue nights (Google Calendar)", pEvents.filter((e) => e.source === "calendar")]
                ] as const
              ).map(([label, list]) =>
                list.length ? (
                  <optgroup key={label} label={label}>
                    {list.map((e) => (
                      <option key={e.id} value={e.id}>
                        {[e.starts_at ? new Date(e.starts_at).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "America/Chicago" }) : null, e.venue_name, e.source === "calendar" ? e.dj_name : e.title].filter(Boolean).join(" · ")}
                      </option>
                    ))}
                  </optgroup>
                ) : null
              )}
            </select>
            {[
              ["DJ 1", pDj1, setPDj1],
              ["DJ 2", pDj2, setPDj2]
            ].map(([l, v, set]) => (
              <select key={l as string} className={cn(inputCls, "w-auto max-w-[150px] py-1 text-xs")} aria-label={`Preview ${l}`} value={v as string} onChange={(e) => (set as (x: string) => void)(e.target.value)}>
                <option value="">{l === "DJ 1" && pWith && !pWith.startsWith("venue:") ? "DJ 1: the booked DJ" : `${l}: empty`}</option>
                {data.djs.map((d) => (
                  <option key={d.id} value={d.id}>
                    {l as string}: {d.display_name}
                  </option>
                ))}
              </select>
            ))}
            {pBusy && <span className="text-muted">…</span>}
          </span>
        }
        backHref="/admin/flyers"
        backLabel="Templates"
        libraryHref="/admin/flyers/assets"
        subtitle={latest ? `Live: version ${latest.version} · edits here go live when you publish` : "Not published yet"}
        onSaveReady={onSaveReady}
        save={save}
        upload={async (file, kind) => {
          const fd = new FormData();
          fd.append("file", file);
          fd.append("kind", kind);
          fd.append("scope", "template");
          const r = await fetch("/api/flyers/assets", { method: "POST", body: fd });
          const j = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(j.error ?? "Upload failed.");
          return j.asset as Asset;
        }}
        headerExtra={
          <div className="flex items-center gap-1.5">
            <select className={cn(inputCls, "hidden w-40 py-1.5 text-xs md:block")} aria-label="Venue for this template" value={venueId} onChange={(e) => void setVenue(e.target.value)}>
              <option value="">Any venue</option>
              {data.venues.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
            <button className={cn(iconBtn, "border-gold bg-gold font-semibold text-[#1a140b]")} onClick={() => void publish()} disabled={publishing}>
              <Rocket size={15} /> {publishing ? "Publishing…" : latest ? "Publish update" : "Publish"}
            </button>
            {msg && (
              <span role="status" className="max-w-[220px] text-[11px] leading-tight text-muted">
                {msg}
              </span>
            )}
          </div>
        }
      />
    </div>
  );
}
