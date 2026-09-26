-- Meetings scheduled by staff on a project (client check-ins, final
-- planning meetings, etc.). A project can have several, so this is its
-- own table rather than a column on events. Deliberately not an `events`
-- row like consultation bookings are: a meeting belongs to an existing
-- booking, it isn't a new lead. All access goes through service-role API
-- routes, so RLS is enabled with no policies.

create table if not exists event_meetings (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  location text,
  meeting_url text,
  notes text,
  status text not null default 'scheduled', -- scheduled, cancelled
  created_by uuid,
  created_at timestamptz not null default now(),
  constraint event_meetings_valid_range check (ends_at > starts_at)
);

create index if not exists idx_event_meetings_event on event_meetings(event_id, starts_at);
create index if not exists idx_event_meetings_upcoming on event_meetings(starts_at) where status = 'scheduled';

alter table event_meetings enable row level security;
