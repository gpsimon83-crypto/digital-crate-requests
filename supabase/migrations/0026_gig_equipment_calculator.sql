-- Gig Equipment Calculator.
--
-- Turns gathered gig details (guest count, event type, hours, and
-- questionnaire answers already collected per event) into a consistent,
-- rules-based equipment recommendation — so every DJ pulling up a
-- similar gig gets the same baseline gear list instead of eyeballing it
-- differently each time. Recommendations become *locked minimums* on
-- that event's package selection: a DJ/client can add more equipment,
-- but can't drop below the floor a rule set — and only an owner/admin
-- can edit the rules that produce those floors.

create table if not exists gig_equipment_rules (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  conditions jsonb not null default '[]'::jsonb,
  catalog_item_id uuid not null references service_catalog_items(id) on delete cascade,
  quantity integer not null default 1,
  reason text,
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_gig_equipment_rules_active on gig_equipment_rules(is_active, position);

-- Locked-minimum quantities from the calculator, keyed by package_line_item
-- id — enforced client- and server-side as a floor, never a client-editable value.
alter table event_package_selections add column if not exists locked_minimums jsonb not null default '{}'::jsonb;

alter table gig_equipment_rules enable row level security;

-- Only owner/admin can manage these rules — deliberately narrower than
-- packages.manage (which also includes manager), per explicit request
-- that locked minimums only be editable by the business owner/admin.
insert into permissions (role, capability) values
  ('owner', 'equipment_rules.manage'),
  ('admin', 'equipment_rules.manage')
on conflict (role, capability) do nothing;
