-- Package templates stay shared across every DJ (10 templates, e.g.
-- "Wedding — Signature"), but the services inside them become exclusive
-- per DJ — each DJ sets their own price/availability for each shared
-- service type. service_catalog_items stays the shared definition of
-- *what a service is*; its price_cents/etc become only a default
-- starting point, seeded into each DJ's own offering row below.
create table if not exists dj_service_offerings (
  id uuid primary key default gen_random_uuid(),
  dj_id uuid not null references djs(id) on delete cascade,
  catalog_item_id uuid not null references service_catalog_items(id) on delete cascade,
  price_cents integer not null,
  internal_cost_cents integer,
  min_quantity integer,
  max_quantity integer,
  is_offered boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dj_id, catalog_item_id)
);

create index if not exists idx_dj_service_offerings_dj on dj_service_offerings(dj_id);

alter table dj_service_offerings enable row level security;

-- Backfill: every existing DJ starts out offering every existing service
-- type at today's global price — a no-op for current behavior. Going
-- forward, each DJ (or admin on their behalf) edits their own row.
insert into dj_service_offerings (dj_id, catalog_item_id, price_cents, internal_cost_cents, min_quantity, max_quantity, is_offered)
select d.id, c.id, c.price_cents, c.internal_cost_cents, c.min_quantity, c.max_quantity, true
from djs d
cross join service_catalog_items c
on conflict (dj_id, catalog_item_id) do nothing;
