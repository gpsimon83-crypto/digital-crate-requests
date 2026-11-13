-- Venue Partner Portal: night plans.
--
-- A venue manager can attach, to any upcoming date (a booked night or a
-- date they'd like covered):
--   * the occasion ("Halloween party", "Packers watch party")
--   * drink specials for that night
--   * a DJ request: which DJ they'd like, plus a note for DCDJs
--
-- A DJ request is a preference, never a booking: Digital Crate DJs
-- confirms nights based on DJ availability. Bookings stay where they are
-- (events table / the shared DCDJ calendar).
--
-- One row per venue per date. Like the other venue tables, only the
-- server (service role) reads and writes it; RLS is on with no policies.

create table if not exists venue_night_plans (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete cascade,
  night_date date not null,
  occasion text check (occasion is null or char_length(occasion) <= 80),
  drink_specials text check (drink_specials is null or char_length(drink_specials) <= 600),
  dj_request_id uuid references djs(id) on delete set null,
  dj_request_name text check (dj_request_name is null or char_length(dj_request_name) <= 80),
  dj_request_note text check (dj_request_note is null or char_length(dj_request_note) <= 400),
  dj_requested_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (venue_id, night_date)
);
create index if not exists idx_venue_night_plans_venue_date on venue_night_plans (venue_id, night_date);

alter table venue_night_plans enable row level security;
