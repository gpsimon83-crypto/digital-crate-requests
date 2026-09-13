-- Closes the remaining wedding-info gaps: an MC announcement script/notes
-- field (wedding_music_plan already covers the songs, not what the DJ
-- actually says), an outdoor-ceremony weather backup plan, a vendor meal
-- count for catering headcount, and venue load-in/parking notes.
alter table events add column if not exists weather_backup_plan text;
alter table events add column if not exists vendor_meal_count integer;
alter table events add column if not exists venue_load_in_notes text;
