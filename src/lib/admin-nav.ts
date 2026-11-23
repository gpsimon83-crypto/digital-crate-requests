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
  ArrowLeft,
  PackageOpen,
  CalendarCheck,
  Mail,
  ShieldCheck,
  Image,
  Inbox,
  GraduationCap
} from "lucide-react";
import { ACADEMY_URL, MEMBERS_AREA } from "@/lib/external-links";
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
      // What's New lives on the Notifications page (and its own page stays at /admin/whats-new).
      { href: "/admin/notifications", label: "Notifications", icon: Bell },
      { href: "/admin/calendar", label: "Calendar", icon: CalendarDays }
    ]
  },
  {
    label: "Work",
    items: [
      { href: "/admin/events", label: "All Projects", icon: Briefcase },
      { href: "/admin/events?stage=inquiries", label: "Leads & Inquiries", icon: Inbox },
      { href: "/admin/clients", label: "Contacts", icon: Users },
      { href: "/admin/venues", label: "Venue Portals", icon: MapPin },
      { href: "/admin/meetings", label: "Meetings", icon: CalendarCheck }
    ]
  },
  {
    label: "Team",
    items: [
      { href: "/admin/djs", label: "DJ Team", icon: Disc3 },
      { href: "/admin/invite-codes", label: "Invite Codes", icon: KeyRound },
      { href: "/admin/equipment", label: "Equipment", icon: Boxes }
    ]
  },
  {
    label: "Business",
    items: [
      { href: "/admin/finance", label: "Finance", icon: Wallet },
      { href: "/admin/reports", label: "Reports & Analytics", icon: BarChart3 },
      { href: "/admin/services", label: "Services", icon: Sparkles },
      { href: "/admin/packages", label: "Packages", icon: PackageOpen },
      { href: "/admin/monetization", label: "Monetization", icon: DollarSign }
    ]
  },
  {
    label: "Communication",
    items: [
      { href: "/admin/communications", label: "Communications", icon: Mail },
      { href: "/admin/automations", label: "Automations", icon: Zap }
    ]
  },
  {
    label: "Resources",
    items: [
      { href: "/admin/crate-requests", label: "Music & Crates", icon: Music2 },
      { href: "/admin/crate-templates", label: "Crate Templates", icon: LayoutTemplate },
      { href: "/admin/flyers", label: "Flyer Creator", icon: Image },
      { href: "/admin/files", label: "Documents & Library", icon: FolderOpen },
      { href: ACADEMY_URL, label: "DCDJs Academy", icon: GraduationCap, external: true },
      { href: MEMBERS_AREA, label: "DJ Members Area", icon: ArrowLeft, external: true }
    ]
  },
  {
    label: "Intake",
    items: [
      { href: "/admin/leads", label: "Lead Capture", icon: Magnet },
      { href: "/admin/security", label: "Inquiry Security", icon: ShieldCheck },
      { href: "/admin/tools/scheduler", label: "Scheduler", icon: CalendarClock },
      { href: "/admin/questionnaires", label: "Questionnaire Builder", icon: ClipboardList }
    ]
  },
  {
    label: "System",
    items: [
      { href: "/admin/settings", label: "Company Settings", icon: Settings },
      { href: "/admin/resources", label: "Help & Resources", icon: LifeBuoy }
    ]
  }
];
