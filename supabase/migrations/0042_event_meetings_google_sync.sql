-- Lets a meeting remember its Google Calendar event so a reschedule or
-- cancel updates/removes the same Google event instead of duplicating it.
alter table event_meetings add column if not exists google_event_id text;
