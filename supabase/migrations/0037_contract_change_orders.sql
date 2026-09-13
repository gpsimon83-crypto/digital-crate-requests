-- A signed contract's key terms (price, event date/times, venue, package
-- selection) had no way to change after signing, and no way for anyone to
-- notice if they did — "the couple needs the DJ for another hour" had
-- nowhere to go except a side conversation. This is the lightweight
-- acknowledgment layer: the original signed contract stays on file as-is
-- (never silently edited), and any tracked-field change while a contract
-- is signed creates a change order that both the client and the assigned
-- DJ must explicitly acknowledge.
create table if not exists contract_change_orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  contract_id uuid references contracts(id) on delete set null,
  changes jsonb not null default '[]',
  client_acknowledged_at timestamptz,
  client_acknowledged_by text,
  dj_acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_contract_change_orders_event on contract_change_orders(event_id, created_at desc);

alter table contract_change_orders enable row level security;
