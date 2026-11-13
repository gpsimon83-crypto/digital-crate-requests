-- DJs as they're written on the shared DCDJ Google Calendar ("Que", "GMO"),
-- with the real name the venue portals should show ("DJ Que").
-- Managed in Admin → Venue Portals. Only the server (service role) reads it.
create table if not exists calendar_dj_names (
  id uuid primary key default gen_random_uuid(),
  calendar_name text not null check (char_length(calendar_name) between 2 and 40),
  display_name text not null check (char_length(display_name) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists calendar_dj_names_calendar_name_key on calendar_dj_names (lower(calendar_name));
alter table calendar_dj_names enable row level security;
