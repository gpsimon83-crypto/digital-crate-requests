-- The public inquiry form only ever captured name/email/phone/date/type —
-- venue, guest count, and budget weren't asked, so staff couldn't triage
-- or price-fit a lead until a later phone call. expected_guests already
-- existed (0002_crm_foundation.sql) but nothing wrote to it at inquiry
-- time; venue is free text here (not the structured venues table) since
-- a first-time inquirer doesn't know your venue list, and budget is a
-- simple range bucket, never a quote.
alter table events add column if not exists venue_name text;
alter table events add column if not exists budget_range text;
