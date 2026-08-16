"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { SideDrawer } from "@/components/ui/side-drawer";
import { ADMIN_NAV_GROUPS } from "@/lib/admin-nav";
import { LayoutDashboard, Briefcase, Users, CalendarDays, Menu } from "lucide-react";

const PRIMARY_ITEMS = [
  { href: "/admin", label: "Home", icon: LayoutDashboard },
  { href: "/admin/events", label: "Projects", icon: Briefcase },
  { href: "/admin/clients", label: "Contacts", icon: Users },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays }
];

export function AdminMobileTabBar() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-20 flex border-t border-black/10 bg-panel/95 backdrop-blur-lg pb-[env(safe-area-inset-bottom)] md:hidden">
        {PRIMARY_ITEMS.map(({ href, label, icon: Icon }, i) => {
          const active = pathname === href;
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
          className="menu-fade-item flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium min-h-[56px] justify-center text-muted"
          style={{ "--menu-fade-delay": `${PRIMARY_ITEMS.length * 40}ms` } as React.CSSProperties}
        >
          <Menu size={20} strokeWidth={1.8} />
          More
        </button>
      </nav>

      <SideDrawer open={moreOpen} onClose={() => setMoreOpen(false)} title="Menu" subtitle="Digital Crate DJs">
        <div className="flex flex-col gap-1">
          {ADMIN_NAV_GROUPS.map((group, gi) => (
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
                    pathname === item.href ? "sidebar-active" : "text-foreground hover:bg-black/5"
                  )}
                >
                  <item.icon size={18} className="shrink-0 text-muted" />
                  {item.label}
                  {item.external && <span className="ml-1 text-muted">↗</span>}
                </Link>
              ))}
            </div>
          ))}
        </div>
      </SideDrawer>
    </>
  );
}
