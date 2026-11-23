"use client";

import { Tabs } from "@/components/ui/tabs";
import { useWhatsNewCount } from "@/lib/use-whats-new";

/** Notifications and What's New share one place in the menu: these tabs switch between them. */
export function InboxTabs({ active }: { active: "notifications" | "whats-new" }) {
  const fresh = useWhatsNewCount();
  return (
    <div data-tour="inbox-tabs">
    <Tabs
      variant="pill"
      label="Notifications and updates"
      active={active}
      hrefFor={(k) => (k === "whats-new" ? "/admin/whats-new" : "/admin/notifications")}
      items={[
        { key: "notifications", label: "Notifications" },
        { key: "whats-new", label: fresh > 0 ? `What's New (${fresh > 9 ? "9+" : fresh})` : "What's New" }
      ]}
    />
    </div>
  );
}
