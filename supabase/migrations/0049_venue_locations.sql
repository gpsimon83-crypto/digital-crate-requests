-- Venue Partner Portal: several locations under one venue (e.g. North 48
-- Cedarburg and North 48 Oconomowoc share one portal).
--
-- venues.locations is a list of
--   { id, name, city, calendar_names[], is_default }
-- calendar_names are how that location is written on the shared DCDJ
-- Google Calendar ("North 48 Ocon"); a night whose title matches one is
-- shown under that location. Nights that only match the venue's own name
-- go to the location marked is_default (if any).
--
-- Night plans (drink specials / DJ requests) become per location: one row
-- per venue, date and location ('' = the venue as a whole).

alter table venues add column if not exists locations jsonb not null default '[]'::jsonb;

alter table venue_night_plans add column if not exists location_id text not null default '';
alter table venue_night_plans drop constraint if exists venue_night_plans_venue_id_night_date_key;
create unique index if not exists venue_night_plans_venue_date_location_key on venue_night_plans (venue_id, night_date, location_id);
