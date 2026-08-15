"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/logo";
import { LogOut } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

export interface SidebarNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Override the default exact-pathname active check (e.g. tab-based portal event links). */
  isActive?: (pathname: string) => boolean;
  disabled?: boolean;
  badge?: number;
  external?: boolean;
}

export interface SidebarNavGroup {
  /** Omit for an ungrouped leading cluster (no heading rendered). */
  label?: string;
  items: SidebarNavItem[];
}

interface SidebarProps {
  brandHref: string;
  brandTitle: string;
  brandSubtitle: string;
  groups: SidebarNavGroup[];
  onSignOut: () => void;
  /** "rail" = collapsed icon rail that expands to w-60 on hover (Admin, Client Portal). "fixed" = always-expanded w-64 (DJ per-event workspace). */
  variant?: "rail" | "fixed";
  /** Rendered below the brand block, above the nav groups — e.g. quick-create + search. */
  headerExtra?: ReactNode;
  /** Rendered above Sign Out — e.g. a DJ identity card. */
  identityFooter?: ReactNode;
}

function NavLabel({ children, variant }: { children: ReactNode; variant: "rail" | "fixed" }) {
  if (variant === "fixed") return <span className="whitespace-nowrap">{children}</span>;
  return (
    <span className="whitespace-nowrap opacity-0 transition-opacity delay-75 duration-150 group-hover:opacity-100">
      {children}
    </span>
  );
}

/**
 * The one nav-rail component for Admin, Client Portal, and the DJ per-event
 * workspace — replaces three independently-maintained sidebars that did the
 * same job with drifting markup. Config-driven via `groups` rather than
 * each surface hand-rolling its own item list + active-state logic.
 */
export function Sidebar({
  brandHref,
  brandTitle,
  brandSubtitle,
  groups,
  onSignOut,
  variant = "rail",
  headerExtra,
  identityFooter
}: SidebarProps) {
  const pathname = usePathname();
  const { offsets: groupOffsets, total: totalItems } = groups.reduce<{ offsets: number[]; total: number }>(
    (acc, g) => ({ offsets: [...acc.offsets, acc.total], total: acc.total + g.items.length }),
    { offsets: [], total: 0 }
  );

  function fadeDelay(index: number) {
    return { "--menu-fade-delay": `${(index + 1) * 40}ms` } as React.CSSProperties;
  }

  const railClasses =
    "group fixed inset-y-0 left-0 z-40 hidden w-16 flex-col gap-1 overflow-x-hidden overflow-y-auto border-r border-border bg-panel/95 p-3 backdrop-blur transition-[width] duration-200 hover:w-60 hover:shadow-xl md:flex";
  const fixedClasses = "hidden w-64 shrink-0 flex-col border-r border-border bg-background p-4 md:flex";

  return (
    <nav className={variant === "rail" ? railClasses : fixedClasses}>
      <Link href={brandHref} className="mb-4 flex items-center gap-2 px-1">
        <Logo variant="icon" brand="crates-djs" size={28} />
        <div>
          <NavLabel variant={variant}>
            <p className="text-[10px] uppercase tracking-[2px] text-muted">{brandSubtitle}</p>
          </NavLabel>
          <NavLabel variant={variant}>
            <p className="text-sm font-semibold">{brandTitle}</p>
          </NavLabel>
        </div>
      </Link>

      {headerExtra}
      {headerExtra && <div className="my-1 h-px bg-border" />}

      <div className="flex flex-1 flex-col gap-1">
        {groups.map((group, gi) => (
          <div key={group.label ?? `group-${gi}`} className="flex flex-col gap-1">
            {gi > 0 && <div className="my-2 h-px bg-border" />}
            {group.label && (
              <p className="px-3 pb-1 text-[10px] uppercase tracking-[2px] text-muted">
                <NavLabel variant={variant}>{group.label}</NavLabel>
              </p>
            )}
            {group.items.map((item, ii) => {
              const Icon = item.icon;
              const active = item.isActive ? item.isActive(pathname) : pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-disabled={item.disabled}
                  target={item.external ? "_blank" : undefined}
                  rel={item.external ? "noopener noreferrer" : undefined}
                  style={fadeDelay(groupOffsets[gi] + ii)}
                  className={cn(
                    "menu-fade-item flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    item.disabled
                      ? "pointer-events-none text-muted/40"
                      : active
                        ? "sidebar-active"
                        : "text-muted hover:bg-black/5 hover:text-foreground"
                  )}
                >
                  <span className="relative shrink-0">
                    <Icon size={18} />
                    {!!item.badge && item.badge > 0 && (
                      <span className="absolute -right-1 -top-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-gold px-0.5 text-[9px] font-bold leading-none text-black">
                        {item.badge > 9 ? "9+" : item.badge}
                      </span>
                    )}
                  </span>
                  <NavLabel variant={variant}>
                    {item.label}
                    {item.external && <span className="ml-1 text-muted">↗</span>}
                  </NavLabel>
                </Link>
              );
            })}
          </div>
        ))}
      </div>

      {identityFooter}

      <button
        onClick={onSignOut}
        style={fadeDelay(totalItems)}
        className="menu-fade-item mt-2 flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <LogOut size={18} className="shrink-0" />
        <NavLabel variant={variant}>Sign Out</NavLabel>
      </button>
    </nav>
  );
}
