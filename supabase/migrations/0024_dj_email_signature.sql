-- Per-DJ contact info shown in the outbound-email signature. Self-serve
-- (each DJ fills in their own from /dj-dashboard/profile), optional, not
-- to be confused with djs.emergency_contact_phone (private, not client-facing).
alter table djs add column if not exists signature_phone text;
alter table djs add column if not exists signature_email text;
