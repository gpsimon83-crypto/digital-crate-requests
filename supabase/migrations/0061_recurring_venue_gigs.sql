-- Recurring Bar / Club bookings ("residencies").
--
-- One venue record keeps the standing information (venues.dj_brief, plus
-- advice pinned from recaps). A venue can have several recurring nights;
-- each night is a residency tied to one Bar / Club project, with its own
-- schedule. Every date is its own gig row with its own hours, DJ, notes,
-- DJ coverage (unassigned / awaiting / confirmed), outcome (scheduled /
-- played / canceled) and, separately, a recap.
--
-- Dates are generated from the schedule into residency_gigs. slot_date is
-- the schedule date a gig came from and is unique per residency, so
-- generating again never creates a duplicate, even after a gig was moved
-- to another day. Only future dates are ever generated or changed by a
-- schedule edit; past gigs stay exactly as they were.
--
-- Money stays per gig: the venue's payments are rows in `payments` with
-- gig_id, the DJ's payout is a row in `payouts` with gig_id. Rates and
-- negotiation notes live on the residency and are only returned to staff
-- with finance access; nothing here is read by the venue portal.
--
-- Additive only. Server-only tables (RLS on, no policies), like the rest
-- of the CRM.

create table if not exists residencies (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null unique references events(id) on delete cascade,
  venue_id uuid references venues(id) on delete set null,
  name text not null check (char_length(name) between 1 and 80),
  -- weekly: every <weekday>; monthly: the listed weeks of the month on <weekday>
  -- (1-4, or 5 = last); manual: only the dates staff add.
  pattern text not null default 'weekly' check (pattern in ('weekly', 'monthly', 'manual')),
  weekday smallint check (weekday is null or weekday between 0 and 6),
  weeks smallint[] not null default '{}',
  start_time time not null default '21:00',
  end_time time not null default '01:00',
  starts_on date not null default current_date,
  ends_on date,
  timezone text not null default 'America/Chicago',
  default_dj_id uuid references djs(id) on delete set null,
  venue_fee_cents integer check (venue_fee_cents is null or venue_fee_cents between 0 and 10000000),
  dj_payout_cents integer check (dj_payout_cents is null or dj_payout_cents between 0 and 10000000),
  money_notes text check (money_notes is null or char_length(money_notes) <= 2000),
  active boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint residency_weekday_needed check (pattern = 'manual' or weekday is not null),
  constraint residency_weeks_valid check (weeks <@ array[1, 2, 3, 4, 5]::smallint[])
);
create index if not exists idx_residencies_venue on residencies (venue_id);

create table if not exists residency_gigs (
  id uuid primary key default uuid_generate_v4(),
  residency_id uuid not null references residencies(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  slot_date date not null,
  gig_date date not null,
  start_time time not null,
  end_time time not null,
  dj_id uuid references djs(id) on delete set null,
  coverage text not null default 'unassigned' check (coverage in ('unassigned', 'awaiting', 'confirmed')),
  outcome text not null default 'scheduled' check (outcome in ('scheduled', 'played', 'canceled')),
  cancel_reason text check (cancel_reason is null or char_length(cancel_reason) <= 300),
  -- This night only: instructions for the DJ on top of the venue brief.
  notes text check (notes is null or char_length(notes) <= 1000),
  source text not null default 'schedule' check (source in ('schedule', 'manual')),
  -- Edited with "This gig only": later schedule edits leave it alone.
  detached boolean not null default false,
  -- No longer on the schedule after an edit, but kept (it had a DJ or notes).
  off_schedule boolean not null default false,
  change_note text check (change_note is null or char_length(change_note) <= 300),
  dj_responded_at timestamptz,
  venue_fee_cents integer check (venue_fee_cents is null or venue_fee_cents between 0 and 10000000),
  dj_payout_cents integer check (dj_payout_cents is null or dj_payout_cents between 0 and 10000000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (residency_id, slot_date),
  constraint gig_dj_matches_coverage check ((coverage = 'unassigned') = (dj_id is null))
);
create index if not exists idx_residency_gigs_event_date on residency_gigs (event_id, gig_date);
create index if not exists idx_residency_gigs_dj_date on residency_gigs (dj_id, gig_date) where dj_id is not null;

create table if not exists residency_recaps (
  id uuid primary key default uuid_generate_v4(),
  gig_id uuid not null unique references residency_gigs(id) on delete cascade,
  residency_id uuid not null references residencies(id) on delete cascade,
  event_id uuid not null references events(id) on delete cascade,
  dj_id uuid references djs(id) on delete set null,
  picked_up text not null check (char_length(picked_up) between 1 and 500),
  worked text not null check (char_length(worked) between 1 and 1000),
  next_dj text not null check (char_length(next_dj) between 1 and 1000),
  issue text check (issue is null or char_length(issue) <= 1000),
  issue_resolved_at timestamptz,
  issue_resolved_by uuid references auth.users(id) on delete set null,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now()
);
create index if not exists idx_residency_recaps_event on residency_recaps (event_id, submitted_at desc);

-- Standing DJ brief on the venue: load_in, house_gear, music, expectations.
alter table venues add column if not exists dj_brief jsonb not null default '{}'::jsonb;

-- Recurring advice pinned to the venue brief; the dated recap it came from stays as it was.
create table if not exists venue_brief_pins (
  id uuid primary key default uuid_generate_v4(),
  venue_id uuid not null references venues(id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  recap_id uuid references residency_recaps(id) on delete set null,
  gig_date date,
  pinned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_venue_brief_pins_venue on venue_brief_pins (venue_id, created_at);

-- Per-gig money in the existing finance tables.
alter table payments add column if not exists gig_id uuid references residency_gigs(id) on delete set null;
create index if not exists idx_payments_gig on payments (gig_id) where gig_id is not null;
alter table payouts add column if not exists gig_id uuid references residency_gigs(id) on delete set null;
create unique index if not exists uq_payouts_gig on payouts (gig_id) where gig_id is not null;

alter table residencies enable row level security;
alter table residency_gigs enable row level security;
alter table residency_recaps enable row level security;
alter table venue_brief_pins enable row level security;
