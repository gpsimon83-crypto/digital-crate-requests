-- DJ payouts and business expenses — Finance currently only tracks money
-- coming in (payments); this adds the two things going out. Per explicit
-- owner decision, payout amounts are set manually per event, not computed
-- from a formula (no hourly/percentage math baked into the schema).

create table if not exists payouts (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  dj_id uuid not null references djs(id) on delete cascade,
  amount_cents integer not null,
  status text not null default 'pending', -- pending | paid
  paid_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint positive_payout check (amount_cents > 0)
);

create index if not exists idx_payouts_event on payouts(event_id);
create index if not exists idx_payouts_dj on payouts(dj_id, status);

create table if not exists expenses (
  id uuid primary key default uuid_generate_v4(),
  description text not null,
  amount_cents integer not null,
  category text, -- equipment, marketing, insurance, software, venue, other
  event_id uuid references events(id) on delete set null,
  incurred_on date not null default current_date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint positive_expense check (amount_cents > 0)
);

create index if not exists idx_expenses_event on expenses(event_id);
create index if not exists idx_expenses_incurred on expenses(incurred_on desc);

alter table payouts enable row level security;
alter table expenses enable row level security;
