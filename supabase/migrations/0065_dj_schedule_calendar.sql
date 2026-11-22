-- The DJ schedule calendar (the shared "DCDJ Calender" the DJs write their
-- gigs on). It's often not the connected account's main calendar, so the CRM
-- reads it separately, into its own table: DJ gigs show on each DJ's
-- Calendar page but don't block public booking slots.
alter table calendar_connection add column if not exists schedule_calendar_id text;
alter table calendar_connection add column if not exists schedule_calendar_name text;
alter table calendar_connection add column if not exists schedule_sync_token text;

create table if not exists dj_schedule_entries (
  google_event_id text primary key,
  summary text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  updated_at timestamptz not null default now()
);
create index if not exists idx_dj_schedule_range on dj_schedule_entries(starts_at, ends_at);
alter table dj_schedule_entries enable row level security;
