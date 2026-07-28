"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PortalSidebarNav } from "@/components/portal/portal-sidebar-nav";
import { PortalMobileTabBar } from "@/components/portal/portal-mobile-tab-bar";
import { pickPrimaryEvent } from "@/lib/portal-primary-event";

const NO_CHROME_PREFIXES = ["/portal/login", "/portal/signup"];

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [primaryEventId, setPrimaryEventId] = useState<string | null>(null);

  const showChrome = !NO_CHROME_PREFIXES.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!showChrome) return;
    (async () => {
      const res = await fetch("/api/portal/me");
      if (!res.ok) return;
      const data = await res.json();
      setPrimaryEventId(pickPrimaryEvent(data.events ?? [])?.id ?? null);
    })();
  }, [showChrome]);

  if (!showChrome) return <>{children}</>;

  return (
    <div className="min-h-dvh bg-background">
      <Suspense fallback={null}>
        <PortalSidebarNav primaryEventId={primaryEventId} />
      </Suspense>
      <div className="overflow-x-hidden pb-20 md:pb-0 md:pl-16">{children}</div>
      <Suspense fallback={null}>
        <PortalMobileTabBar primaryEventId={primaryEventId} />
      </Suspense>
    </div>
  );
}
