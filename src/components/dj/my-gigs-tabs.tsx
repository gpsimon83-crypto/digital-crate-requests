"use client";

import { usePathname } from "next/navigation";
import { Tabs } from "@/components/ui/tabs";

const ITEMS = [
  { key: "/dj-dashboard/bookings", label: "Bookings" },
  { key: "/dj-dashboard/gigs", label: "Recurring gigs" },
  { key: "/dj-dashboard/leads", label: "Leads" }
];

/** My Gigs: the existing Bookings, Recurring gigs and Leads pages as one menu item with tabs. */
export function MyGigsTabs() {
  const pathname = usePathname();
  return <Tabs variant="pill" label="My Gigs" items={ITEMS} active={pathname} hrefFor={(k) => k} className="" />;
}
