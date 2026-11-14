"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Rocket } from "lucide-react";
import { FlyerEditorClient } from "@/components/flyers/client";
import { iconBtn, inputCls, type Asset, type VenueOpt } from "@/components/flyers/editor-panels";
import type { SaveResult, Scenes } from "@/components/flyers/flyer-editor";
import { cn } from "@/lib/utils";
import { FORMAT_KEYS, type TemplateContent } from "@/lib/flyers/types";

type Loaded = {
  template: { id: string; name: string; description: string | null; venue_id: string | null; status: string; current_version_id: string | null; draft: TemplateContent; updated_at: string };
  versions: { id: string; version: number; published_at: string }[];
  shared: Asset[];
  venues: VenueOpt[];
  djs: { id: string; display_name: string; has_photo: boolean }[];
};

const SAMPLE = { dj_name: "DJ Name", event_title: "Saturday Night", event_date: "Saturday, November 22", start_time: "9 PM", end_time: "2 AM", venue_name: "Venue Name", venue_address: "123 Main St, Milwaukee, WI" };

export default function TemplateEditPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [venueId, setVenueId] = useState<string>("");
  const [publishing, setPublishing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
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
