"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { AssetManager } from "@/components/flyers/asset-manager";

export default function MyFlyerUploadsPage() {
  return (
    <div className="min-h-dvh bg-background">
      <PageHeader
        title="My Uploads"
        subtitle="Your photos and images for flyers. Only you (and Digital Crate DJs staff) can see them."
        action={
          <Link href="/dj-dashboard/flyers" className="flex items-center gap-1.5 rounded-[10px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted hover:text-foreground">
            <ArrowLeft size={13} /> My flyers
          </Link>
        }
      />
      <main className="mx-auto max-w-7xl px-6 py-8 sm:px-8">
        <AssetManager scope="dj" />
      </main>
    </div>
  );
}
