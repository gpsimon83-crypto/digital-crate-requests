-- Consultation-call scheduler: weekly recurring available hours (not tied
-- to any specific date) plus a single slot-duration setting. Bookings
-- themselves are NOT a new table — a booked slot is just an `events` row
-- with event_type='consultation' and status='inquiry', reusing the exact
-- same lead/inquiry pipeline the homepage's booking form already writes
-- to (see lib/data/inquiries.ts) so a scheduled call shows up in Lead
-- Capture and the admin Calendar for free.

create table if not exists scheduler_availability (
  day_of_week smallint primary key check (day_of_week between 0 and 6), -- 0=Sunday..6=Saturday
  enabled boolean not null default false,
  start_time time not null default '10:00',
  end_time time not null default '16:00'
);

insert into scheduler_availability (day_of_week, enabled, start_time, end_time) values
  (0, false, '10:00', '16:00'),
  (1, true,  '10:00', '16:00'),
  (2, true,  '10:00', '16:00'),
  (3, true,  '10:00', '16:00'),
  (4, true,  '10:00', '16:00'),
  (5, true,  '10:00', '16:00'),
  (6, false, '10:00', '16:00')
on conflict (day_of_week) do nothing;

create table if not exists scheduler_settings (
  id boolean primary key default true check (id),
  slot_minutes int not null default 30
);

insert into scheduler_settings (id, slot_minutes) values (true, 30)
on conflict (id) do nothing;

-- RLS enabled with zero policies, matching every other table in this app —
-- all real reads/writes go through API routes using the service-role
-- client, which bypasses RLS regardless.
alter table scheduler_availability enable row level security;
alter table scheduler_settings enable row level security;
