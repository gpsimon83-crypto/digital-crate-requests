"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SideDrawer } from "@/components/ui/side-drawer";
import { ADMIN_NAV_GROUPS } from "@/lib/admin-nav";
import { useWhatsNewCount } from "@/lib/use-whats-new";
import { SiteThemeList } from "@/components/admin/site-theme";
import { LayoutDashboard, Briefcase, Users, CalendarDays, Menu, ExternalLink } from "lucide-react";

const PRIMARY_ITEMS = [
  { href: "/admin", label: "Home", icon: LayoutDashboard },
  { href: "/admin/events", label: "Projects", icon: Briefcase },
  { href: "/admin/clients", label: "Contacts", icon: Users },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays }
];

type NavItem = { href: string; label: string; icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>; external?: boolean; alsoActive?: string[] };
type NavGroup = { label?: string; items: NavItem[] };

/** Phone tab bar: four main places plus More (every page, and Site theme). The DJ portal passes its own. */
export function AdminMobileTabBar({ primary = PRIMARY_ITEMS, groups = ADMIN_NAV_GROUPS as unknown as NavGroup[], extra }: { primary?: NavItem[]; groups?: NavGroup[]; /** Shown at the top of the More menu (e.g. Update Availability, the view switch). */ extra?: React.ReactNode } = {}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const whatsNew = useWhatsNewCount();
  const PRIMARY = primary;

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-20 flex border-t border-black/10 bg-panel/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] md:hidden">
        {PRIMARY.map(({ href, label, icon: Icon, alsoActive }, i) => {
          const active = pathname === href || !!alsoActive?.includes(pathname);
          return (
            <Link
              key={href}
              href={href}
              style={{ "--menu-fade-delay": `${i * 40}ms` } as React.CSSProperties}
              className={cn(
                "menu-fade-item flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium min-h-[56px] justify-center",
                active ? "text-gold" : "text-muted"
              )}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
        <button
          onClick={() => setMoreOpen(true)}
          data-tour="mobile-more"
          className="menu-fade-item flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium min-h-[56px] justify-center text-muted"
          style={{ "--menu-fade-delay": `${PRIMARY.length * 40}ms` } as React.CSSProperties}
        >
          <span className="relative">
            <Menu size={20} strokeWidth={1.8} />
            {whatsNew > 0 && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-gold" aria-label="New updates" />}
          </span>
          More
        </button>
      </nav>

      <SideDrawer open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu" subtitle="Digital Crate DJs">
        <div className="flex flex-col gap-1">
          {extra && <div className="mb-2 flex flex-col gap-2">{extra}</div>}
          {groups.map((group, gi) => (
            <div key={group.label ?? `group-${gi}`}>
              {gi > 0 && <div className="my-2 h-px bg-border" />}
              {group.label && <p className="px-1 pb-1 text-[10px] uppercase tracking-[2px] text-muted">{group.label}</p>}
              {group.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    pathname === item.href || item.alsoActive?.includes(pathname) ? "sidebar-active" : "text-foreground hover:bg-black/5"
                  )}
                >
                  <item.icon size={18} className="shrink-0 text-muted" />
                  {item.label}
                  {item.external && (
                    <>
                      <ExternalLink size={13} className="text-muted" aria-hidden />
                      <span className="sr-only"> (opens in a new tab)</span>
                    </>
                  )}
                  {item.href === "/admin/whats-new" && whatsNew > 0 && (
                    <span className="ml-auto rounded-full bg-gold px-1.5 text-[10px] font-semibold text-[#1A140A]">{whatsNew > 9 ? "9+" : whatsNew}</span>
                  )}
                </Link>
              ))}
            </div>
          ))}
          <div className="my-2 h-px bg-border" />
          <p className="px-1 pb-1 text-[10px] uppercase tracking-[2px] text-muted" data-tour="site-theme-mobile">Site theme</p>
          <SiteThemeList compact />
        </div>
      </SideDrawer>
    </>
  );
}
