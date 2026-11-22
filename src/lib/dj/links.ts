import type { DashLinks } from "@/components/dashboard/overview/widgets";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Where DJ dashboard items open: their project page, or the calendar for Google Calendar entries. */
export const DJ_LINKS: DashLinks = {
  project: (id) => (UUID.test(id) ? `/dj-dashboard/projects/${id}` : "/dj-dashboard/calendar"),
  allProjects: "/dj-dashboard/bookings",
  calendar: "/dj-dashboard/calendar",
  category: () => "/dj-dashboard/bookings"
};
