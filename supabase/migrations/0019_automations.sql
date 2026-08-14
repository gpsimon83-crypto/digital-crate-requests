-- Real trigger -> condition -> action workflow engine, replacing the
-- honest "not built yet" placeholder at /admin/automations.
--
-- `conditions` is a flat array of {field, operator, value} evaluated
-- against a context object built from the event row at run time — kept
-- simple (equals/not_equals only) since every trigger in this v1 fires
-- from a single, already-known event. `actions` is an ordered array of
-- {type, ...params}; each action type is implemented in
-- src/lib/automations-engine.ts, not stored as code here.
create table if not exists automations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  trigger text not null,
  conditions jsonb not null default '[]',
  actions jsonb not null default '[]',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_automations_trigger on automations(trigger) where is_active;

-- One row per automation per firing, whether or not its conditions
-- matched — gives a real run history / error log, not just a "last run"
-- timestamp, per the audit spec's Run History requirement.
create table if not exists automation_runs (
  id uuid primary key default uuid_generate_v4(),
  automation_id uuid not null references automations(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  status text not null, -- 'ran' | 'skipped' | 'error'
  detail text,
  actions_run jsonb not null default '[]',
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_runs_automation on automation_runs(automation_id, created_at desc);

alter table automations enable row level security;
alter table automation_runs enable row level security;
