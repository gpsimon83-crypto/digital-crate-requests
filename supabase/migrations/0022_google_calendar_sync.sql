-- Two-way Google Calendar sync. One company-wide connection (single-tenant
-- business, not per-DJ) — singleton row pattern matches scheduler_settings
-- (migration 0006). Tokens encrypted at rest with the same AES-256-GCM
-- helper already used for email account passwords.

create table if not exists calendar_connection (
  id boolean primary key default true check (id),
  google_calendar_id text not null default 'primary',
  connected_email text,
  encrypted_access_token text not null,
  encrypted_refresh_token text not null,
  access_token_expires_at timestamptz not null,
  sync_token text,
  connected_by uuid references auth.users(id),
  connected_at timestamptz not null default now(),
  last_synced_at timestamptz,
  last_sync_status text,
  last_sync_error text
);

alter table events add column if not exists google_event_id text;

-- Events pulled FROM Google Calendar that aren't ours (personal
-- appointments, other commitments) — surfaced as busy blocks on the
-- internal Calendar page and factored into Scheduler availability, without
-- being turned into real `events`/client records.
create table if not exists external_calendar_busy_blocks (
  id uuid primary key default uuid_generate_v4(),
  google_event_id text not null unique,
  summary text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  updated_at timestamptz not null default now()
);
create index if not exists idx_external_busy_range on external_calendar_busy_blocks(starts_at, ends_at);

alter table calendar_connection enable row level security;
alter table external_calendar_busy_blocks enable row level security;
