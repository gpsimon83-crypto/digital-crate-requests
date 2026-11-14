"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { FlyerEditorClient } from "@/components/flyers/client";
import type { Asset, VenueOpt } from "@/components/flyers/editor-panels";
import type { SaveResult, Scenes } from "@/components/flyers/flyer-editor";
import type { FormatKey, Scene } from "@/lib/flyers/types";

type Loaded = {
  design: { id: string; dj_id: string; title: string; format: FormatKey; scene: Scene; updated_at: string };
  template: { name: string; version: number | null } | null;
  owner: { id: string; display_name: string; has_photo: boolean } | null;
  viewer: { staff: boolean; isOwner: boolean };
  uploads: Asset[];
  shared: Asset[];
  venues: VenueOpt[];
};

export default function FlyerEditPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const base = useRef<string | null>(null);

  useEffect(() => {
    fetch(`/api/flyers/designs/${id}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error ?? "Couldn't open this flyer.");
        base.current = j.design.updated_at;
        setData(j);
      })
      .catch((e) => setError(e.message));
  }, [id]);

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
      deleteUpload={async (assetId) => {
        const r = await fetch(`/api/flyers/assets/${assetId}`, { method: "DELETE" });
        if (!r.ok) throw new Error("Couldn't delete.");
      }}
    />
  );
}
