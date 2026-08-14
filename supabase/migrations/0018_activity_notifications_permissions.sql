-- Phase 1 of the CRM restructure: activity history, a notification inbox,
-- and a data-driven permissions table.
--
-- All three are purely additive — nothing existing reads or writes them
-- yet. This migration only creates the tables and (for permissions) seeds
-- rows that describe today's actual behavior, so turning on enforcement
-- later is a code change, not a data migration.

-- ============================================
-- ACTIVITY_LOG
-- ============================================
-- actor_label is denormalized (captured at write time) so history reads
-- correctly even if the acting user/DJ is later renamed or removed —
-- same reasoning as email_messages.from_name.
create table if not exists activity_log (
  id uuid primary key default uuid_generate_v4(),
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_label text,
  action text not null, -- e.g. 'event.confirmed', 'contract.signed', 'payment.received'
  entity_type text not null, -- 'event', 'client', 'dj', 'contract', 'payment', 'questionnaire', ...
  entity_id uuid,
  event_id uuid references events(id) on delete cascade,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_log_event on activity_log(event_id, created_at desc);
create index if not exists idx_activity_log_created on activity_log(created_at desc);

-- ============================================
-- NOTIFICATIONS
-- ============================================
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null, -- 'dj_assignment_pending', 'contract_unsigned', 'payment_overdue', ...
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  event_id uuid references events(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_notifications_user on notifications(user_id, read_at, created_at desc);

-- ============================================
-- PERMISSIONS (data-driven RBAC)
-- ============================================
-- `role` is a superset of every tier that exists today: user_metadata.role
-- ('owner'/'admin'/'manager') for staff, plus 'dj' and 'client' for the two
-- tiers that are currently determined by row-ownership rather than a role
-- string (a djs row / a clients row with matching auth_user_id). Seeded
-- below to match current de facto behavior exactly — enabling real
-- capability checks against this table is a separate, later code change.
create table if not exists permissions (
  id uuid primary key default uuid_generate_v4(),
  role text not null,
  capability text not null,
  granted boolean not null default true,
  created_at timestamptz not null default now(),
  unique (role, capability)
);

insert into permissions (role, capability) values
  ('owner', 'events.view_all'), ('owner', 'events.edit'), ('owner', 'events.delete'),
  ('owner', 'clients.view_all'), ('owner', 'clients.edit'),
  ('owner', 'finance.view_company'), ('owner', 'finance.manage'),
  ('owner', 'members.manage'), ('owner', 'permissions.manage'), ('owner', 'settings.manage'),
  ('admin', 'events.view_all'), ('admin', 'events.edit'), ('admin', 'events.delete'),
  ('admin', 'clients.view_all'), ('admin', 'clients.edit'),
  ('admin', 'finance.view_company'), ('admin', 'finance.manage'),
  ('admin', 'members.manage'), ('admin', 'settings.manage'),
  ('manager', 'events.view_all'), ('manager', 'events.edit'),
  ('manager', 'clients.view_all'), ('manager', 'clients.edit'),
  ('manager', 'finance.view_company'),
  ('dj', 'events.view_assigned'), ('dj', 'clients.view_assigned'),
  ('dj', 'finance.view_own_payout'), ('dj', 'questionnaires.view'),
  ('client', 'events.view_own'), ('client', 'contracts.view'), ('client', 'questionnaires.edit')
on conflict (role, capability) do nothing;

-- ============================================
-- ROW LEVEL SECURITY
-- Same default-deny pattern as every other table added since 0002 — real
-- authorization is enforced in the API layer via the service-role client.
-- ============================================
alter table activity_log enable row level security;
alter table notifications enable row level security;
alter table permissions enable row level security;
