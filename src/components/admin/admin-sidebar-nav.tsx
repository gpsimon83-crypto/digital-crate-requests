"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/site/logo";
import { createClient } from "@/lib/supabase/client";
import {
  Home,
  Briefcase,
  CalendarDays,
  Users,
  Magnet,
  Sparkles,
  FolderOpen,
  Wallet,
  Wrench,
  Zap,
  BarChart3,
  Disc3,
  MapPin,
  Boxes,
  LayoutTemplate,
  DollarSign,
  KeyRound,
  Music2,
  LifeBuoy,
  Settings,
  ArrowLeft,
  LogOut
} from "lucide-react";

// Primary items mirror a standard CRM's information architecture (Home,
// Projects, Calendar, Contacts, Lead capture, Services, Library, Finance,
// Tools, Automations, Reports). Library is the one, real home for email
// templates/contracts/brochures — it used to be split between a stub
// "Templates" page here and the real Library tool buried in Tools; this
// entry now points straight at that same real page instead of duplicating
// it.
const PRIMARY_ITEMS = [
  { href: "/admin", label: "Home", icon: Home },
  { href: "/admin/events", label: "Projects", icon: Briefcase },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/clients", label: "Contacts", icon: Users },
  { href: "/admin/leads", label: "Lead capture", icon: Magnet },
  { href: "/admin/services", label: "Services", icon: Sparkles },
  { href: "/admin/files", label: "Library", icon: FolderOpen },
  { href: "/admin/finance", label: "Finance", icon: Wallet },
  { href: "/admin/tools", label: "Tools", icon: Wrench },
  { href: "/admin/automations", label: "Automations", icon: Zap },
  { href: "/admin/reports", label: "Reports", icon: BarChart3 }
];

// CratesDJ-specific operations that don't map to a generic CRM's menu —
// kept as their own group rather than dropped, since they're real,
// in-use functionality (DJ roster, venue partners, gear inventory, the
// DJ-facing music-curation tool, Stripe/pricing config, invite codes).
const OPERATIONS_ITEMS = [
  { href: "/admin/djs", label: "DJs", icon: Disc3 },
  { href: "/admin/venues", label: "Venues", icon: MapPin },
  { href: "/admin/equipment", label: "Equipment", icon: Boxes },
  { href: "/admin/crate-templates", label: "Crate Templates", icon: LayoutTemplate },
  { href: "/admin/crate-requests", label: "Crate Requests", icon: Music2 },
  { href: "/admin/monetization", label: "Monetization", icon: DollarSign },
  { href: "/admin/invite-codes", label: "Invite Codes", icon: KeyRound }
];

const FOOTER_ITEMS = [
  { href: "/admin/resources", label: "Resources", icon: LifeBuoy },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];

function NavLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="whitespace-nowrap opacity-0 transition-opacity delay-75 duration-150 group-hover:opacity-100">
      {children}
    </span>
  );
}

export function AdminSidebarNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/dj-dashboard/login");
    router.refresh();
  }

  const operationsOffset = PRIMARY_ITEMS.length;
  const footerOffset = operationsOffset + OPERATIONS_ITEMS.length;
  const djPortalOffset = footerOffset + FOOTER_ITEMS.length;
  const signOutOffset = djPortalOffset + 1;

  function fadeDelay(index: number) {
    return { "--menu-fade-delay": `${(index + 1) * 40}ms` } as React.CSSProperties;
  }

  return (
    <nav className="group fixed inset-y-0 left-0 z-40 hidden w-16 flex-col gap-1 overflow-x-hidden overflow-y-auto border-r border-black/10 bg-panel/95 p-3 backdrop-blur transition-[width] duration-200 hover:w-60 hover:shadow-xl md:flex">
      <Link href="/admin" className="mb-4 flex items-center gap-2 px-1">
        <Logo variant="icon" brand="crates-djs" size={28} />
        <div>
          <NavLabel>
            <p className="text-[10px] uppercase tracking-[2px] text-muted">Digital Crate DJs</p>
          </NavLabel>
          <NavLabel>
            <p className="text-sm font-semibold">Admin</p>
          </NavLabel>
        </div>
      </Link>

      {PRIMARY_ITEMS.map(({ href, label, icon: Icon }, i) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            style={fadeDelay(i)}
            className={cn(
              "menu-fade-item flex items-center gap-3 rounded-[2px] px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "sidebar-active" : "text-muted hover:bg-black/5 hover:text-foreground"
            )}
          >
            <Icon size={18} className="shrink-0" />
            <NavLabel>{label}</NavLabel>
          </Link>
        );
      })}

      <div className="my-2 h-px bg-black/10" />
      <p className="px-3 pb-1 text-[10px] uppercase tracking-[2px] text-muted">
        <NavLabel>CratesDJ Operations</NavLabel>
      </p>

      {OPERATIONS_ITEMS.map(({ href, label, icon: Icon }, i) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            style={fadeDelay(operationsOffset + i)}
            className={cn(
              "menu-fade-item flex items-center gap-3 rounded-[2px] px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "sidebar-active" : "text-muted hover:bg-black/5 hover:text-foreground"
            )}
          >
            <Icon size={18} className="shrink-0" />
            <NavLabel>{label}</NavLabel>
          </Link>
        );
      })}

      <div className="my-2 h-px bg-black/10" />

      {FOOTER_ITEMS.map(({ href, label, icon: Icon }, i) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            style={fadeDelay(footerOffset + i)}
            className={cn(
              "menu-fade-item flex items-center gap-3 rounded-[2px] px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "sidebar-active" : "text-muted hover:bg-black/5 hover:text-foreground"
            )}
          >
            <Icon size={18} className="shrink-0" />
            <NavLabel>{label}</NavLabel>
          </Link>
        );
      })}

      <a
        href="https://digitalcratedjs.com/members"
        style={fadeDelay(djPortalOffset)}
        className="menu-fade-item flex items-center gap-3 rounded-[2px] px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <ArrowLeft size={18} className="shrink-0" />
        <NavLabel>DJ Portal</NavLabel>
      </a>
      <button
        onClick={handleLogout}
        style={fadeDelay(signOutOffset)}
        className="menu-fade-item flex items-center gap-3 rounded-[2px] px-3 py-2.5 text-left text-sm font-medium text-muted transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <LogOut size={18} className="shrink-0" />
        <NavLabel>Sign Out</NavLabel>
      </button>
    </nav>
  );
}
