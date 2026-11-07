import { Suspense } from "react";
import type { Metadata } from "next";
import { VenueDashboard } from "@/components/venue/venue-dashboard";

export const metadata: Metadata = { title: "Venue Partner Portal · Digital Crate DJs" };

export default function VenuePage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#0b0b0b]" />}>
      <VenueDashboard />
    </Suspense>
  );
}
