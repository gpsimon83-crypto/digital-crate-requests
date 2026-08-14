// Shared between the server-side permissions data layer and the client-side
// matrix editor — no server-only imports here so it's safe in both bundles.
export const ROLES = ["owner", "admin", "manager", "dj", "client"] as const;
export type Role = (typeof ROLES)[number];

export const CAPABILITY_GROUPS: { group: string; capabilities: { value: string; label: string }[] }[] = [
  {
    group: "Events",
    capabilities: [
      { value: "events.view_all", label: "View every event" },
      { value: "events.view_assigned", label: "View own assigned events" },
      { value: "events.view_own", label: "View own booked event" },
      { value: "events.edit", label: "Edit events" },
      { value: "events.delete", label: "Delete events" }
    ]
  },
  {
    group: "Clients",
    capabilities: [
      { value: "clients.view_all", label: "View every client" },
      { value: "clients.view_assigned", label: "View clients on own events" },
      { value: "clients.edit", label: "Edit clients" }
    ]
  },
  {
    group: "Finance",
    capabilities: [
      { value: "finance.view_company", label: "View company-wide finance" },
      { value: "finance.view_own_payout", label: "View own payout" },
      { value: "finance.manage", label: "Manage finance (record payments)" }
    ]
  },
  {
    group: "Planning",
    capabilities: [
      { value: "questionnaires.view", label: "View questionnaires" },
      { value: "questionnaires.edit", label: "Fill out questionnaire" },
      { value: "contracts.view", label: "View contract" }
    ]
  },
  {
    group: "Admin",
    capabilities: [
      { value: "members.manage", label: "Manage staff/DJ members" },
      { value: "settings.manage", label: "Manage platform settings" },
      { value: "permissions.manage", label: "Manage this permissions matrix" }
    ]
  }
];
