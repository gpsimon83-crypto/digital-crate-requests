import { Bell, BookOpen, CalendarCheck, CalendarDays, CalendarClock, ClipboardList, Disc3, GraduationCap, Home, Image, Library, MessagesSquare, Sparkles, UserCircle, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ACADEMY_URL } from "@/lib/external-links";

export interface DjNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  external?: boolean;
  /** Also active on these paths (tabs of the same page). */
  alsoActive?: string[];
}

/** My Gigs is one page with tabs over the existing Bookings, Recurring gigs and Leads pages. */
export const MY_GIGS_PATHS = ["/dj-dashboard/bookings", "/dj-dashboard/gigs", "/dj-dashboard/leads"];

/**
 * The DJ portal's menu (side rail on desktop, tab bar + More on phones).
 * Every item is an existing page; there's no link for a page that doesn't
 * exist yet (Help & Support has no page yet, so it isn't listed).
 */
export const DJ_NAV_GROUPS: { label?: string; items: DjNavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/dj-dashboard", label: "Home", icon: Home },
      { href: "/dj-dashboard/notifications", label: "Notifications", icon: Bell }
    ]
  },
  {
    label: "My work",
    items: [
      { href: "/dj-dashboard/bookings", label: "My Gigs", icon: Disc3, alsoActive: MY_GIGS_PATHS },
      { href: "/dj-dashboard/calendar", label: "Calendar & Availability", icon: CalendarDays },
      { href: "/dj-dashboard/tasks", label: "Tasks & Planning", icon: ClipboardList },
      { href: "/dj-dashboard/messages", label: "Messages", icon: MessagesSquare },
      { href: "/dj-dashboard/meetings", label: "Meetings", icon: CalendarCheck }
    ]
  },
  {
    label: "Resources",
    items: [
      { href: "/dj-dashboard/library", label: "Music & Crates", icon: Library },
      { href: "/dj-dashboard/flyers", label: "Flyer Creator", icon: Image },
      { href: ACADEMY_URL, label: "DCDJs Academy", icon: GraduationCap, external: true },
      { href: "/dj-dashboard/documents", label: "Documents & Library", icon: BookOpen }
    ]
  },
  {
    label: "Account",
    items: [
      { href: "/dj-dashboard/payouts", label: "My Earnings", icon: Wallet },
      { href: "/dj-dashboard/profile", label: "My Profile", icon: UserCircle },
      { href: "/dj-dashboard/services", label: "Services & Pricing", icon: Sparkles }
    ]
  }
];

export const DJ_TAB_ITEMS = [
  { href: "/dj-dashboard", label: "Home", icon: Home },
  { href: "/dj-dashboard/bookings", label: "My Gigs", icon: Disc3 },
  { href: "/dj-dashboard/calendar", label: "Calendar", icon: CalendarClock },
  { href: "/dj-dashboard/tasks", label: "Tasks", icon: ClipboardList }
];

/** Pages that are full-screen tools or sign-in screens: no menu around them. */
export function djShellHidden(pathname: string) {
  return (
    pathname === "/dj-dashboard/login" ||
    pathname.startsWith("/dj-dashboard/signup") ||
    // The flyer editor fills the screen (the flyer list and library keep the menu).
    (/^\/dj-dashboard\/flyers\/[^/]+$/.test(pathname) && pathname !== "/dj-dashboard/flyers/library")
  );
}
