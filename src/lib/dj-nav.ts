import { Bell, CalendarDays, CalendarClock, Disc3, Home, Image, Inbox, Library, Repeat, Sparkles, UserCircle, Wallet } from "lucide-react";

/**
 * The DJ portal's menu (side rail on desktop, tab bar + More on phones).
 * Every DJ page in one place, grouped the way the admin menu is.
 */
export const DJ_NAV_GROUPS = [
  {
    items: [
      { href: "/dj-dashboard", label: "Home", icon: Home },
      { href: "/dj-dashboard/notifications", label: "Notifications", icon: Bell },
      { href: "/dj-dashboard/calendar", label: "Calendar", icon: CalendarDays }
    ]
  },
  {
    label: "Work",
    items: [
      { href: "/dj-dashboard/bookings", label: "Bookings", icon: Disc3 },
      { href: "/dj-dashboard/leads", label: "Leads", icon: Inbox },
      { href: "/dj-dashboard/gigs", label: "Recurring gigs", icon: Repeat },
      { href: "/dj-dashboard/payouts", label: "Payouts", icon: Wallet }
    ]
  },
  {
    label: "Promote",
    items: [
      { href: "/dj-dashboard/flyers", label: "Flyer Creator", icon: Image },
      { href: "/dj-dashboard/services", label: "Services & pricing", icon: Sparkles },
      { href: "/dj-dashboard/profile", label: "Profile", icon: UserCircle }
    ]
  },
  {
    label: "Music",
    items: [{ href: "/dj-dashboard/library", label: "Library", icon: Library }]
  }
];

export const DJ_TAB_ITEMS = [
  { href: "/dj-dashboard", label: "Home", icon: Home },
  { href: "/dj-dashboard/bookings", label: "Bookings", icon: Disc3 },
  { href: "/dj-dashboard/leads", label: "Leads", icon: Inbox },
  { href: "/dj-dashboard/calendar", label: "Calendar", icon: CalendarClock }
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
