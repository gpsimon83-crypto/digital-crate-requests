"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/dashboard/page-header";
import { DjServicesEditor } from "@/components/services/dj-services-editor";

export default function DjServicesPage() {
  return (
    <div className="min-h-dvh bg-background">
      <PageHeader
        title="My Services"
        subtitle="Your own pricing and availability for each shared service type."
        action={
          <Link
            href="/dj-dashboard/bookings"
            className="flex items-center gap-1.5 rounded-[10px] border border-black/12 px-3.5 py-2 text-xs font-medium text-muted transition-colors hover:border-black/25 hover:text-foreground"
          >
            <ArrowLeft size={14} /> Back
          </Link>
        }
      />
      <div className="flex flex-col gap-4 p-6">
        <DjServicesEditor endpoint="/api/dj/services" />
      </div>
    </div>
  );
}
