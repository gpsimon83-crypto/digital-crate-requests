-- No wedding-day timeline/run-of-show exists anywhere — real clock times
-- entered by the couple (who know their actual schedule from their venue/
-- planner), not computed/guessed by the app. Any event type, not just
-- weddings, though the client UI surfaces it in the wedding music tab.
alter table events add column if not exists day_timeline jsonb not null default '[]'::jsonb;
