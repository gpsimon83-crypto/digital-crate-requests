"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Disc3, LayoutDashboard } from "lucide-react";
import { cn } from "@/lib/utils";

/** Whether this login can switch between Admin View and DJ View (staff linked to a DJ profile). */
export function useCanSwitchView() {
  const [can, setCan] = useState(false);
  useEffect(() => {
    fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setCan(!!d?.canSwitchView))
      .catch(() => {});
  }, []);
  return can;
}

/**
 * Admin View ⇄ DJ View. Shown only to staff whose login is linked to their
 * own DJ profile; the server checks again before switching (see
 * /api/me/view-mode), and it only changes how the DJ pages are presented.
 */
export function ViewSwitch({ to, variant = "rail" }: { to: "dj" | "admin"; variant?: "rail" | "sheet" }) {
  const can = useCanSwitchView();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!can) return null;
  const Icon = to === "dj" ? Disc3 : LayoutDashboard;
  const label = to === "dj" ? "Switch to DJ View" : "Switch to Admin View";
  async function go() {
    setBusy(true);
    try {
      const res = await fetch("/api/me/view-mode", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: to }) });
      if (!res.ok) throw new Error();
      router.push(to === "dj" ? "/dj-dashboard" : "/admin");
      router.refresh();
    } catch {
      setBusy(false);
    }
  }
  return (
    <button
      type="button"
      onClick={go}
      disabled={busy}
      data-tour="view-switch"
      aria-label={label}
      className={cn(
        "menu-fade-item flex w-full items-center gap-3 rounded-[10px] border border-border px-3 py-2.5 text-left text-sm font-medium text-foreground transition-colors hover:border-gold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold",
        variant === "rail" && "mb-2"
      )}
    >
      <Icon size={18} className="shrink-0 text-gold" aria-hidden />
      <span className={cn("whitespace-nowrap", variant === "rail" && "opacity-0 transition-opacity delay-75 duration-150 group-hover:opacity-100 group-focus-within:opacity-100")}>
        {busy ? "Switching…" : to === "dj" ? "DJ View" : "Admin View"}
      </span>
    </button>
  );
}
