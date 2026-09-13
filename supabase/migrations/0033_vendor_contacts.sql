-- A DJ running a wedding has no vendor contact list anywhere in the app —
-- photographer/planner/venue coordinator numbers all live outside the
-- system today. Client-editable, any event type (not wedding-only).
alter table events add column if not exists vendor_contacts jsonb not null default '[]'::jsonb;
