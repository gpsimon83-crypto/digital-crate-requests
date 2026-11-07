-- Venue Partner Portal, Phase A.
--
-- Reuses the existing venues table (one record per venue, already linked
-- to events and venue_djs) and adds:
--   * portal + branding + scheduling-preference columns on venues
--   * venue_managers: which logins may see which venues (a manager can
--     belong to several venues; access is checked server-side against
--     this table on every request)
--   * venue_audit_log: who changed what, never deleted
--
-- Bar-night DJ assignments stay in the WordPress members area (the
-- Availability Hub). calendar_names lists how this venue is written in
-- the shared DCDJ Google Calendar, so later phases can match those
-- nights to this venue without creating duplicate booking records.
--
-- Like the rest of the CRM, these tables are only read and written by
-- the server (service role); RLS is on with no policies so the public
-- anon key can't touch them.

alter table venues add column if not exists slug text;
create unique index if not exists venues_slug_key on venues (slug) where slug is not null;
alter table venues add column if not exists is_active boolean not null default true;
alter table venues add column if not exists portal_enabled boolean not null default false;
alter table venues add column if not exists logo_url text;
alter table venues add column if not exists cover_url text;
alter table venues add column if not exists cover_focus jsonb not null default '{"desktop":{"x":50,"y":50},"mobile":{"x":50,"y":50}}'::jsonb;
alter table venues add column if not exists dcdjs_contact_name text;
alter table venues add column if not exists dcdjs_contact_email text;
alter table venues add column if not exists dcdjs_contact_phone text;
alter table venues add column if not exists recurring_nights jsonb not null default '[]'::jsonb;
alter table venues add column if not exists scheduling_prefs jsonb not null default '{}'::jsonb;
alter table venues add column if not exists calendar_names text[] not null default '{}';
alter table venues add column if not exists updated_at timestamptz not null default now();

create table if not exists venue_managers (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  title text,
  phone text,
  is_active boolean not null default true,
  invited_by uuid references auth.users(id) on delete set null,
  invited_at timestamptz not null default now(),
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  unique (venue_id, user_id)
);
create index if not exists idx_venue_managers_user on venue_managers (user_id) where is_active;

create table if not exists venue_audit_log (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid references venues(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  actor_label text,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_venue_audit_venue on venue_audit_log (venue_id, created_at desc);

alter table venue_managers enable row level security;
alter table venue_audit_log enable row level security;
