"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FlyerEditorClient } from "@/components/flyers/client";
import type { Asset, VenueOpt } from "@/components/flyers/editor-panels";
import type { EventOpt, LinkData, LinkProps, SaveResult, Scenes } from "@/components/flyers/flyer-editor";
import type { FormatKey, Scene } from "@/lib/flyers/types";

type Loaded = {
  design: { id: string; dj_id: string; title: string; format: FormatKey; scene: Scene; updated_at: string; template_id: string | null; exported_at?: string | null };
  template: { name: string; version: number | null } | null;
  owner: { id: string; display_name: string; has_photo: boolean } | null;
  viewer: { staff: boolean; isOwner: boolean };
  uploads: Asset[];
  shared: Asset[];
  venues: VenueOpt[];
  context: LinkData;
  events: EventOpt[];
  templates: LinkProps["templates"];
  activeTemplate: LinkProps["activeTemplate"];
  allDjs: LinkProps["allDjs"];
  linksReady: boolean;
};

export default function FlyerEditPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = useRef<string | null>(null);
  const saveNow = useRef<(() => Promise<boolean>) | null>(null);
  // Bumped when the flyer is reloaded from the server (after switching template), so the editor starts fresh.
  const [rev, setRev] = useState(0);

  const fetchDesign = useCallback(async (): Promise<Loaded> => {
    const r = await fetch(`/api/flyers/designs/${id}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error ?? "Couldn't open this flyer.");
    return j as Loaded;
  }, [id]);

  useEffect(() => {
    fetchDesign()
      .then((j) => {
        base.current = j.design.updated_at;
        setData(j);
      })
      .catch((e) => setError(e.message));
  }, [fetchDesign]);

  const patch = useCallback(
    async (body: Record<string, unknown>) => {
      const r = await fetch(`/api/flyers/designs/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.updated_at) base.current = j.updated_at;
      return { ok: r.ok, j };
    },
    [id]
  );

  const link: LinkProps | undefined = useMemo(() => {
    if (!data) return undefined;
    return {
      context: data.context,
      events: data.events,
      templates: data.templates,
      currentTemplateId: data.design.template_id,
      activeTemplate: data.activeTemplate,
      allDjs: data.allDjs,
      ready: data.linksReady,
      change: async (body) => {
        // Save what's on screen first, so the refill starts from the latest layout.
        if (saveNow.current && !(await saveNow.current())) return { error: "Save your changes first (the last save didn't go through)." };
        const { ok, j } = await patch(body);
        if (!ok) return { error: j.error ?? "Couldn't change that." };
        return { context: j.context as LinkData };
      },
      refresh: async () => {
        try {
          return (await fetchDesign()).context;
        } catch {
          return null;
        }
      },
      applyTemplate: async (templateId) => {
        if (saveNow.current && !(await saveNow.current())) return "Save your changes first (the last save didn't go through).";
        const { ok, j } = await patch({ applyTemplate: templateId });
        if (!ok) return j.error ?? "Couldn't switch template.";
        const fresh = await fetchDesign();
        base.current = fresh.design.updated_at;
        setData(fresh);
        setRev((x) => x + 1);
        return null;
      },
      onExported: data.linksReady ? () => void patch({ exported: true }) : undefined,
      designId: data.design.id,
      sendToVenue: async (png, o) => {
        const fd = new FormData();
        fd.append("file", new File([png], "flyer.png", { type: "image/png" }));
        if (o.note.trim()) fd.append("note", o.note.trim());
        if (o.replace) fd.append("replace", "1");
        const r = await fetch(`/api/flyers/designs/${id}/send`, { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        return r.ok ? { ok: true, message: `Sent to ${j.venue?.name ?? "the venue"}'s portal. They can download it as PNG or JPEG.` } : { ok: false, message: j.error ?? "Couldn't send it to the venue." };
      }
    };
  }, [data, patch, fetchDesign, id]);

  const save = useCallback(
    async (scenes: Scenes, title: string): Promise<SaveResult> => {
      if (!data) return { ok: false, error: "Not loaded" };
      const scene = scenes[data.design.format];
      try {
        const r = await fetch(`/api/flyers/designs/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scene, title, baseUpdatedAt: base.current })
        });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) return { ok: false, error: j.error ?? "Couldn't save.", conflict: !!j.conflict };
        base.current = j.updated_at;
        return { ok: true };
      } catch {
        return { ok: false, error: "You're offline. Changes will save when you reconnect." };
      }
    },
    [data, id]
  );

  if (error)
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <p className="text-sm text-status-declined">{error}</p>
          <Link href="/dj-dashboard/flyers" className="mt-3 inline-block text-sm text-gold underline">
            Back to my flyers
          </Link>
        </div>
      </div>
    );
  if (!data) return <div className="grid h-dvh place-items-center text-sm text-muted">Opening flyer…</div>;

  const d = data.design;
  return (
    <FlyerEditorClient
      key={rev}
      mode="design"
      title={d.title}
      scenes={{ [d.format]: d.scene }}
      format={d.format}
      staff={data.viewer.staff}
      owner={data.owner}
      uploads={data.uploads}
      shared={data.shared}
      venues={data.venues}
      backHref="/dj-dashboard/flyers"
      backLabel="My flyers"
      subtitle={[data.template ? `${data.template.name}${data.template.version ? ` v${data.template.version}` : ""}` : null, !data.viewer.isOwner && data.owner ? `${data.owner.display_name}'s flyer` : null].filter(Boolean).join(" · ")}
      save={save}
      upload={async (file, kind) => {
        const fd = new FormData();
        fd.append("file", file);
        fd.append("kind", kind === "photo" ? "photo" : "image");
        fd.append("scope", "dj");
        fd.append("djId", d.dj_id);
        const r = await fetch("/api/flyers/assets", { method: "POST", body: fd });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Upload failed.");
        return j.asset as Asset;
      }}
      libraryHref={data.viewer.isOwner ? "/dj-dashboard/flyers/library" : undefined}
      link={link}
      onSaveReady={(fn) => {
        saveNow.current = fn;
      }}
    />
  );
}
