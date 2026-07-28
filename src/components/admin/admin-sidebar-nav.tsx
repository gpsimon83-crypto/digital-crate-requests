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
  FolderOpen,
  Sparkles,
  FileStack,
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
  LifeBuoy,
  Settings,
  ArrowLeft,
  LogOut
} from "lucide-react";

// Primary items mirror a standard CRM's information architecture (Home,
// Projects, Calendar, Contacts, Lead capture, Files, Services, Templates,
// Finance, Tools, Automations, Reports) — some are fully real pages built
// on data we already have (Projects=Events, Contacts=Clients, Calendar,
// Lead capture, Finance, Reports); Files/Templates/Automations are honest
// "coming soon" placeholders, not faked functionality, since they'd need
// real new infrastructure (file storage, a template editor, a workflow
// engine) this pass doesn't build.
const PRIMARY_ITEMS = [
  { href: "/admin", label: "Home", icon: Home },
  { href: "/admin/events", label: "Projects", icon: Briefcase },
  { href: "/admin/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/admin/clients", label: "Contacts", icon: Users },
  { href: "/admin/leads", label: "Lead capture", icon: Magnet },
  { href: "/admin/files", label: "Files", icon: FolderOpen },
  { href: "/admin/services", label: "Services", icon: Sparkles },
  { href: "/admin/templates", label: "Templates", icon: FileStack },
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
  { href: "/admin/monetization", label: "Monetization", icon: DollarSign },
  { href: "/admin/invite-codes", label: "Invite Codes", icon: KeyRound }
];

const FOOTER_ITEMS = [
  { href: "/admin/resources", label: "Resources", icon: LifeBuoy },
  { href: "/admin/settings", label: "Settings", icon: Settings }
];

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
    <nav className="hidden w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-black/10 bg-panel/60 p-4 md:flex">
      <Link href="/admin" className="mb-4 flex items-center gap-2 px-2">
        <Logo variant="icon" brand="wing" size={28} />
        <div>
          <p className="text-[10px] uppercase tracking-[2px] text-muted">Digital Crate DJs</p>
          <p className="text-sm font-semibold">Admin</p>
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
              "menu-fade-item flex items-center gap-3 rounded-[2px] px-4 py-2.5 text-sm font-medium transition-colors",
              active ? "sidebar-active" : "text-muted hover:bg-black/5 hover:text-foreground"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}

      <div className="my-2 h-px bg-black/10" />
      <p className="px-4 pb-1 text-[10px] uppercase tracking-[2px] text-muted">CratesDJ Operations</p>

      {OPERATIONS_ITEMS.map(({ href, label, icon: Icon }, i) => {
        const active = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            style={fadeDelay(operationsOffset + i)}
            className={cn(
              "menu-fade-item flex items-center gap-3 rounded-[2px] px-4 py-2.5 text-sm font-medium transition-colors",
              active ? "sidebar-active" : "text-muted hover:bg-black/5 hover:text-foreground"
            )}
          >
            <Icon size={18} />
            {label}
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
              "menu-fade-item flex items-center gap-3 rounded-[2px] px-4 py-2.5 text-sm font-medium transition-colors",
              active ? "sidebar-active" : "text-muted hover:bg-black/5 hover:text-foreground"
            )}
          >
            <Icon size={18} />
            {label}
          </Link>
        );
      })}

      <a
        href="https://digitalcratedjs.com/members"
        style={fadeDelay(djPortalOffset)}
        className="menu-fade-item flex items-center gap-3 rounded-[2px] px-4 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <ArrowLeft size={18} />
        DJ Portal
      </a>
      <button
        onClick={handleLogout}
        style={fadeDelay(signOutOffset)}
        className="menu-fade-item flex items-center gap-3 rounded-[2px] px-4 py-2.5 text-left text-sm font-medium text-muted transition-colors hover:bg-black/5 hover:text-foreground"
      >
        <LogOut size={18} />
        Sign Out
      </button>
    </nav>
  );
}
