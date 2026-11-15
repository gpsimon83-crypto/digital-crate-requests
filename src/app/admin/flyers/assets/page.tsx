"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { AssetManager } from "@/components/flyers/asset-manager";

export default function FlyerAssetsPage() {
  const [djs, setDjs] = useState<{ id: string; display_name: string }[]>([]);
  const [dj, setDj] = useState("");
  useEffect(() => {
    fetch("/api/flyers")
      .then((r) => r.json())
      .then((j) => setDjs(j.djs ?? []))
      .catch(() => undefined);
  }, []);
  return (
    <div>
      <PageHeader
        title="Flyer Art Library"
        subtitle="Backgrounds, overlays and logos used in flyer templates. Organise them into folders, rename, or delete what you don't need."
        action={
          <Link href="/admin/flyers" className="flex items-center gap-1.5 rounded-[10px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted hover:text-foreground">
            <ArrowLeft size={13} /> Templates
          </Link>
        }
      />
      <div className="mx-auto max-w-7xl px-6 py-8 sm:px-8">
        <div className="mb-6 flex flex-wrap items-center gap-2 rounded-[14px] border border-black/10 bg-card p-3">
          <label className="text-sm font-semibold" htmlFor="lib-dj">
            Library
          </label>
          <select id="lib-dj" className="rounded-[8px] border border-black/12 bg-white px-2.5 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold" value={dj} onChange={(e) => setDj(e.target.value)}>
            <option value="">Template art (shared)</option>
            {djs.map((d) => (
              <option key={d.id} value={d.id}>
                {d.display_name}: cutouts, name logo, photos
              </option>
            ))}
          </select>
          {dj && <span className="text-xs text-muted">Approve cutouts and name logos, and pick the preferred one. Flyers use only approved ones.</span>}
        </div>
        {dj ? <AssetManager key={dj} scope="dj" djId={dj} staff /> : <AssetManager scope="template" staff />}
      </div>
    </div>
  );
}
