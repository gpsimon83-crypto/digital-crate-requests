-- Real service packages (replaces the aspirational "Services" placeholder)
-- and their optional add-ons, so pricing has an actual catalog behind it
-- instead of only the free-form quoted_amount/final_amount on events.
create table if not exists packages (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  price numeric(10, 2) not null,
  hours numeric(4, 1),
  features jsonb not null default '[]'::jsonb,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists package_addons (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  price numeric(10, 2) not null,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table packages enable row level security;
alter table package_addons enable row level security;
-- No policies — service-role-only access via admin API routes, same
-- pattern as every other table in this app.
