"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/logo";
import { createClient } from "@/lib/supabase/client";
import { Home, FolderOpen, Sparkles, Wallet, LogOut } from "lucide-react";

function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap opacity-0 transition-opacity delay-75 duration-150 group-hover:opacity-100">
      {children}
    </span>
  );
}

export function PortalSidebarNav({ primaryEventId }: { primaryEventId: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();

  const currentTab = searchParams.get("tab");
  const onEventPage = pathname.startsWith("/portal/events");

  const items = [
    { href: "/portal", label: "Home", icon: Home, tab: null, disabled: false },
    { href: primaryEventId ? `/portal/events/${primaryEventId}?tab=files` : "#", label: "Files", icon: FolderOpen, tab: "files", disabled: !primaryEventId },
    { href: primaryEventId ? `/portal/events/${primaryEventId}?tab=services` : "#", label: "Services", icon: Sparkles, tab: "services", disabled: !primaryEventId },
    { href: primaryEventId ? `/portal/events/${primaryEventId}?tab=payment` : "#", label: "Payments", icon: Wallet, tab: "payment", disabled: !primaryEventId }
  ];

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/portal/login");
    router.refresh();
  }

  return (
    <nav className="group fixed inset-y-0 left-0 z-40 hidden w-16 flex-col gap-1 overflow-x-hidden overflow-y-auto border-r border-black/10 bg-panel/95 p-3 backdrop-blur transition-[width] duration-200 hover:w-60 hover:shadow-xl md:flex">
      <Link href="/portal" className="mb-4 flex items-center gap-2 px-1">
        <Logo variant="icon" brand="crates-djs" size={28} />
        <div>
          <NavLabel>
            <p className="text-[10px] uppercase tracking-[2px] text-muted">Digital Crate DJs</p>
          </NavLabel>
          <NavLabel>
            <p className="text-sm font-semibold">Events Portal</p>
          </NavLabel>
        </div>
      </Link>

      {items.map(({ href, label, icon: Icon, tab, disabled }, i) => {
        const active = tab === null ? pathname === "/portal" : onEventPage && currentTab === tab;
        return (
          <Link
            key={label}
            href={href}
            aria-disabled={disabled}
            style={{ "--menu-fade-delay": `${(i + 1) * 40}ms` } as React.CSSProperties}
            className={cn(
              "menu-fade-item flex items-center gap-3 rounded-[2px] px-3 py-2.5 text-sm font-medium transition-colors",
              disabled
                ? "pointer-events-none text-muted/40"
                : active
                  ? "sidebar-active"
                  : "text-muted hover:bg-black/5 hover:text-foreground"
            )}
          >
            <Icon size={18} className="shrink-0" />
            <NavLabel>{label}</NavLabel>
          </Link>
        );
      })}

      <div className="mt-auto" />
      <button
        onClick={handleSignOut}
        style={{ "--menu-fade-delay": `${(items.length + 1) * 40}ms` } as React.CSSProperties}
        className="menu-fade-item flex items-center gap-3 rounded-[2px] px-3 py-2.5 text-left text-sm font-medium text-muted transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <LogOut size={18} className="shrink-0" />
        <NavLabel>Sign Out</NavLabel>
      </button>
    </nav>
  );
}
