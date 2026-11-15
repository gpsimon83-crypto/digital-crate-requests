-- Flyer Creator: flyers for venue nights on the Google Calendar, and
-- finished flyers sent to a venue's portal.
-- Additive only: nothing existing is changed or removed.

-- 1. A flyer can be for a venue night from the shared DCDJ Google Calendar
--    (not only for a CRM event). A snapshot of the night: id, venue, date,
--    hours, DJ. The calendar itself is never written to.
alter table flyer_designs add column if not exists calendar_night jsonb;

-- 2. Flyers sent to a venue portal. The image is a copy made when it was
--    sent (stored in the private flyer-assets bucket), so later edits to the
--    flyer don't change what the venue already has; send again to update.
create table if not exists venue_flyers (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete cascade,
  design_id uuid references flyer_designs(id) on delete set null,
  title text not null check (char_length(title) <= 120),
  night_date date,
  note text check (note is null or char_length(note) <= 500),
  storage_path text not null,
  width int not null,
  height int not null,
  bytes int,
  sent_by uuid references auth.users(id) on delete set null,
  sent_at timestamptz not null default now(),
  hidden boolean not null default false
);
create index if not exists idx_venue_flyers_venue on venue_flyers (venue_id, sent_at desc);
create index if not exists idx_venue_flyers_design on venue_flyers (design_id);
alter table venue_flyers enable row level security;
