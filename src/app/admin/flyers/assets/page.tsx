"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { AssetManager } from "@/components/flyers/asset-manager";

export default function FlyerAssetsPage() {
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
        <AssetManager scope="template" />
      </div>
    </div>
  );
}
