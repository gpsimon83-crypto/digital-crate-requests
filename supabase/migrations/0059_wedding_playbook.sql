-- Wedding Playbook: coached tasks inside each wedding's existing Tasks tab.
-- Template tasks live in the same `tasks` table as manual ones, so the
-- admin Tasks tab, the DJ's project page and the client portal all read the
-- same records. Additive only: existing tasks keep working unchanged.

alter table tasks add column if not exists template_key text;
alter table tasks add column if not exists stage smallint;
-- Who acts: booking staff, the designated booking lead, the assigned DJ, or the client.
alter table tasks add column if not exists owner text check (owner is null or owner in ('staff', 'booking_lead', 'dj', 'client'));
alter table tasks add column if not exists status text not null default 'open' check (status in ('open', 'waiting', 'done'));
-- When waiting: what's missing and who needs to act.
alter table tasks add column if not exists waiting_reason text check (waiting_reason is null or char_length(waiting_reason) <= 300);
alter table tasks add column if not exists waiting_on text check (waiting_on is null or waiting_on in ('staff', 'booking_lead', 'dj', 'client'));
-- A due date someone set by hand is never recalculated.
alter table tasks add column if not exists due_overridden boolean not null default false;
alter table tasks add column if not exists completed_by uuid references auth.users(id) on delete set null;
-- Ticked "Ready when" items, recap answers, request details, draft text.
alter table tasks add column if not exists checklist jsonb not null default '{}'::jsonb;
alter table tasks add column if not exists data jsonb not null default '{}'::jsonb;
-- Why a reviewed task was reopened ("Venue changed. Recheck load-in and audio setup.").
alter table tasks add column if not exists review_note text;
-- The key details when it was marked ready, to notice later changes.
alter table tasks add column if not exists reviewed_snapshot jsonb;
-- Outreach send log: claimed while sending, sent once delivered (prevents duplicates).
alter table tasks add column if not exists send_claimed_at timestamptz;
alter table tasks add column if not exists sent_at timestamptz;
alter table tasks add column if not exists updated_at timestamptz not null default now();

update tasks set status = 'done' where completed_at is not null and status <> 'done';

-- Each template task exists once per event, however often the playbook syncs.
create unique index if not exists uq_tasks_event_template on tasks (event_id, template_key) where template_key is not null;

-- Editable timing for each playbook task: days from an anchor
-- ('event' = the wedding date, 'booked' = when the project was created).
create table if not exists playbook_task_timing (
  key text primary key,
  anchor text not null default 'event' check (anchor in ('event', 'booked')),
  offset_days integer not null check (offset_days between -400 and 120),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
alter table playbook_task_timing enable row level security;

insert into playbook_task_timing (key, anchor, offset_days) values
  ('inquiry_details', 'booked', 1),
  ('proposal_scope', 'booked', 3),
  ('proposal_sent', 'booked', 5),
  ('contract_signed', 'booked', 14),
  ('retainer_paid', 'booked', 14),
  ('assign_dj', 'booked', 14),
  ('dj_review_booking', 'event', -75),
  ('client_questionnaire', 'event', -60),
  ('dj_read_questionnaire', 'event', -45),
  ('dj_planning_call', 'event', -30),
  ('equipment_review', 'event', -21),
  ('client_music_plan', 'event', -14),
  ('dj_verify_first_dance', 'event', -7),
  ('dj_music_review', 'event', -7),
  ('dj_opening_set', 'event', -7),
  ('dj_day_before', 'event', -1),
  ('dj_wedding_day', 'event', 0),
  ('dj_recap', 'event', 1),
  ('staff_thank_you', 'event', 2),
  ('staff_review_request', 'event', 4),
  ('staff_referral', 'event', 10)
on conflict (key) do nothing;
