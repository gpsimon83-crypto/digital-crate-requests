import {
  Home,
  Bell,
  Briefcase,
  CalendarDays,
  Users,
  Magnet,
  Sparkles,
  FolderOpen,
  Wallet,
  Zap,
  BarChart3,
  Disc3,
  MapPin,
  Boxes,
  LayoutTemplate,
  DollarSign,
  KeyRound,
  Music2,
  Settings,
  CalendarClock,
  ClipboardList,
  LifeBuoy,
  ArrowLeft
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
}

export interface AdminNavGroup {
  label?: string;
  items: AdminNavItem[];
}

/**
 * The single source of truth for Admin navigation — used by the desktop
 * sidebar rail and the mobile "More" sheet, so they can never drift out
 * of sync with each other the way two independently hand-maintained
 * item lists would.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    items: [
      { href: "/admin", label: "Home", icon: Home },
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/calendar", label: "Calendar", icon: CalendarDays }
    ]
  },
  {
    label: "Workspace",
    items: [
      { href: "/admin/events", label: "Projects", icon: Briefcase },
      { href: "/admin/clients", label: "Contacts", icon: Users },
      { href: "/admin/leads", label: "Lead Capture", icon: Magnet }
    ]
  },
  {
    label: "Business",
    items: [
      { href: "/admin/finance", label: "Finance", icon: Wallet },
      { href: "/admin/reports", label: "Reports", icon: BarChart3 }
    ]
  },
  {
    label: "Communication",
    items: [{ href: "/admin/files", label: "Library", icon: FolderOpen }]
  },
  {
    label: "Team",
    items: [
      { href: "/admin/djs", label: "DJs", icon: Disc3 },
      { href: "/admin/equipment", label: "Equipment", icon: Boxes }
    ]
  },
  {
    label: "Tools",
    items: [
      { href: "/admin/crate-requests", label: "Crate Requests", icon: Music2 },
      { href: "/admin/crate-templates", label: "Crate Templates", icon: LayoutTemplate },
      { href: "/admin/monetization", label: "Monetization", icon: DollarSign },
      { href: "/admin/venues", label: "Venues", icon: MapPin },
      { href: "/admin/services", label: "Services", icon: Sparkles },
      { href: "/admin/tools/scheduler", label: "Scheduler", icon: CalendarClock },
      { href: "/admin/questionnaires", label: "Questionnaire Builder", icon: ClipboardList },
      { href: "/admin/automations", label: "Automations", icon: Zap },
      { href: "/admin/invite-codes", label: "Invite Codes", icon: KeyRound }
    ]
  },
  {
    label: "System",
    items: [
      { href: "/admin/settings", label: "Settings", icon: Settings },
      { href: "/admin/resources", label: "Resources", icon: LifeBuoy }
    ]
  },
  {
    items: [{ href: "https://digitalcratedjs.com/members", label: "DJ Portal", icon: ArrowLeft, external: true }]
  }
];
