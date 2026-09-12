"use client";

import { Suspense, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { PortalSidebarNav } from "@/components/portal/portal-sidebar-nav";
import { PortalMobileTabBar } from "@/components/portal/portal-mobile-tab-bar";
import { pickPrimaryEvent } from "@/lib/portal-primary-event";

const NO_CHROME_PREFIXES = ["/portal/login", "/portal/signup", "/portal/questionnaire"];
// The main event page (its own top header + hero, per the luxury portal
// redesign) — but not its subpages (/pay, /package), which still use the
// sidebar shell.
const EVENT_HOME_PATTERN = /^\/portal\/events\/[^/]+\/?$/;

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [primaryEventId, setPrimaryEventId] = useState<string | null>(null);

  const showChrome = !NO_CHROME_PREFIXES.some((p) => pathname.startsWith(p)) && !EVENT_HOME_PATTERN.test(pathname);

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
