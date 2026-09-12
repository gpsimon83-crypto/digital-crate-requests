-- Performance Package Builder.
--
-- A new, parallel system to the flat `packages`/`package_addons` tables
-- from 0016 (left untouched — that Services page and its
-- package-recommendation feature keep working exactly as they do today).
-- This is the real, structured version: a reusable service catalog,
-- template -> sections -> line items (same shape as the questionnaire
-- builder in 0013, deliberately, since that pattern already proved out
-- admin-builder + client-renderer over a versioned tree), pricing rules,
-- dependency/visibility rules, and a deals catalog with eligibility
-- scoping. `event_package_selections` is the saved/submitted quote,
-- carrying a frozen price_snapshot so template edits never retroactively
-- change a client's existing quote.

-- ============================================
-- SERVICE CATALOG
-- ============================================
create table if not exists service_catalog_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text,
  image_url text,
  category text not null default 'other',
  pricing_method text not null default 'fixed'
    check (pricing_method in ('fixed', 'hourly', 'per_person', 'per_unit', 'per_event', 'quote_only')),
  unit_label text,
  price_cents integer not null default 0,
  internal_cost_cents integer,
  min_quantity integer,
  max_quantity integer,
  is_client_visible boolean not null default true,
  is_active boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- PACKAGE TEMPLATES
-- ============================================
create table if not exists package_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  event_type text,
  tier text check (tier in ('essential', 'signature', 'premium')),
  description text,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  is_starter boolean not null default false,
  duplicated_from uuid references package_templates(id) on delete set null,

  display_mode text not null default 'fixed_total'
    check (display_mode in ('fixed_total', 'starting_price', 'price_range', 'quote_only')),
  base_price_cents integer not null default 0,

  included_hours numeric(4,1),
  minimum_hours numeric(4,1),
  overtime_increment_minutes integer,
  overtime_price_cents integer,

  travel_radius_miles numeric(6,1),
  travel_flat_fee_cents integer,
  travel_per_mile_cents integer,

  min_guest_count integer,
  max_guest_count integer,

  min_price_cents integer,
  max_discount_percent numeric(5,2),

  deposit_type text check (deposit_type in ('percent', 'flat')),
  deposit_value numeric(10,2),

  tax_percent numeric(5,2),
  additional_fees jsonb not null default '[]'::jsonb,

  intro_copy text,
  confirmation_message text,
  primary_color text,
  icon text,
  image_url text,
  cta_customize_label text not null default 'Customize This Package',
  cta_request_label text not null default 'Request This Package',
  cta_save_quote_label text not null default 'Save My Quote',

  version int not null default 1,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_package_templates_event_type on package_templates(event_type);

-- ============================================
-- SECTIONS
-- ============================================
create table if not exists package_sections (
  id uuid primary key default gen_random_uuid(),
  package_template_id uuid not null references package_templates(id) on delete cascade,
  title text not null,
  description text,
  position int not null default 0,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_package_sections_template on package_sections(package_template_id, position);

-- ============================================
-- LINE ITEMS
-- ============================================
create table if not exists package_line_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references package_sections(id) on delete cascade,
  catalog_item_id uuid references service_catalog_items(id) on delete set null,

  name_override text,
  description_override text,
  pricing_method_override text
    check (pricing_method_override in ('fixed', 'hourly', 'per_person', 'per_unit', 'per_event', 'quote_only')),
  price_cents_override integer,

  included_quantity integer not null default 0,
  min_quantity integer,
  max_quantity integer,

  selection_mode text not null default 'optional'
    check (selection_mode in ('included', 'required', 'optional', 'locked', 'hidden')),
  is_client_visible boolean not null default true,
  position int not null default 0,
  created_at timestamptz not null default now(),

  constraint package_line_items_named check (catalog_item_id is not null or name_override is not null)
);

create index if not exists idx_package_line_items_section on package_line_items(section_id, position);

-- ============================================
-- DEPENDENCY / VISIBILITY RULES
-- ============================================
create table if not exists package_rules (
  id uuid primary key default gen_random_uuid(),
  package_template_id uuid not null references package_templates(id) on delete cascade,
  rule_type text not null check (rule_type in ('requires', 'excludes', 'show_if')),
  subject_line_item_id uuid references package_line_items(id) on delete cascade,
  target_line_item_id uuid references package_line_items(id) on delete cascade,
  condition jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_package_rules_template on package_rules(package_template_id);

-- ============================================
-- PRICING ADJUSTMENT RULES (guest bands / seasonal / day-of-week)
-- ============================================
create table if not exists package_pricing_rules (
  id uuid primary key default gen_random_uuid(),
  package_template_id uuid not null references package_templates(id) on delete cascade,
  rule_type text not null check (rule_type in ('day_of_week', 'date_range', 'guest_band', 'season')),
  label text not null,
  match jsonb not null default '{}'::jsonb,
  adjustment_type text not null check (adjustment_type in ('percent', 'flat_cents')),
  adjustment_value numeric(10,2) not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_package_pricing_rules_template on package_pricing_rules(package_template_id, position);

-- ============================================
-- DEALS
-- ============================================
create table if not exists deals (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  deal_type text not null check (deal_type in (
    'percent', 'fixed', 'bundle', 'complimentary_upgrade', 'early_booking',
    'last_minute', 'loyalty', 'referral', 'multi_event'
  )),
  value numeric(10,2),
  code text unique,
  starts_at timestamptz,
  ends_at timestamptz,
  eligible_event_start date,
  eligible_event_end date,
  blackout_dates date[] not null default '{}',
  min_spend_cents integer,
  usage_limit integer,
  usage_count integer not null default 0,
  max_discount_cents integer,
  is_public boolean not null default true,
  is_stackable boolean not null default false,
  status text not null default 'draft' check (status in ('draft', 'active', 'expired', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists deal_eligibility (
  id uuid primary key default gen_random_uuid(),
  deal_id uuid not null references deals(id) on delete cascade,
  package_template_id uuid references package_templates(id) on delete cascade,
  catalog_item_id uuid references service_catalog_items(id) on delete cascade,
  constraint deal_eligibility_target check (package_template_id is not null or catalog_item_id is not null)
);

create index if not exists idx_deal_eligibility_deal on deal_eligibility(deal_id);
create index if not exists idx_deal_eligibility_template on deal_eligibility(package_template_id);

-- ============================================
-- SAVED / SUBMITTED PACKAGE SELECTIONS ("quotes")
-- ============================================
create table if not exists event_package_selections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  package_template_id uuid references package_templates(id) on delete set null,
  package_template_version int,
  status text not null default 'draft' check (status in ('draft', 'saved', 'requested', 'confirmed', 'superseded')),
  selections jsonb not null default '{}'::jsonb,
  applied_deal_ids uuid[] not null default '{}',
  price_snapshot jsonb not null default '{}'::jsonb,
  is_current boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_event_package_selections_event on event_package_selections(event_id, is_current);

-- ============================================
-- events: link to the approved selection
-- ============================================
alter table events add column if not exists package_selection_id uuid references event_package_selections(id) on delete set null;

-- ============================================
-- PERMISSIONS — Packages capability group
-- ============================================
insert into permissions (role, capability) values
  ('owner', 'packages.manage'), ('owner', 'packages.view_cost'),
  ('admin', 'packages.manage'), ('admin', 'packages.view_cost'),
  ('manager', 'packages.manage')
on conflict (role, capability) do nothing;

-- ============================================
-- ROW LEVEL SECURITY — same default-deny pattern as every table since 0013
-- ============================================
alter table service_catalog_items enable row level security;
alter table package_templates enable row level security;
alter table package_sections enable row level security;
alter table package_line_items enable row level security;
alter table package_rules enable row level security;
alter table package_pricing_rules enable row level security;
alter table deals enable row level security;
alter table deal_eligibility enable row level security;
alter table event_package_selections enable row level security;

-- ============================================
-- STARTER TEMPLATES (draft, editable examples — never auto-published)
-- ============================================
insert into package_templates (name, event_type, description, status, is_starter, display_mode, base_price_cents, included_hours, position)
values
  ('Wedding — Signature', 'wedding', 'Starter example for a wedding booking. Edit every field before publishing — sample price only.', 'draft', true, 'fixed_total', 180000, 5, 0),
  ('Bar & Nightclub', 'bar_nightclub', 'Starter example for a recurring club/bar night. Edit every field before publishing — sample price only.', 'draft', true, 'fixed_total', 60000, 4, 1),
  ('Corporate Event', 'corporate', 'Starter example for a corporate booking. Edit every field before publishing — sample price only.', 'draft', true, 'fixed_total', 120000, 4, 2),
  ('Private Party', 'private_party', 'Starter example for a birthday/private party. Edit every field before publishing — sample price only.', 'draft', true, 'fixed_total', 90000, 4, 3),
  ('School & Community', 'school_dance', 'Starter example for a school dance or community event. Edit every field before publishing — sample price only.', 'draft', true, 'fixed_total', 75000, 3, 4),
  ('Holiday Event', 'holiday', 'Starter example for a holiday party. Edit every field before publishing — sample price only.', 'draft', true, 'fixed_total', 95000, 4, 5),
  ('Recurring Residency', 'residency', 'Starter example for a recurring weekly/monthly residency. Edit every field before publishing — sample price only.', 'draft', true, 'fixed_total', 50000, 4, 6),
  ('Custom Performance', 'custom', 'Blank-ish starting point for a fully custom booking. Edit every field before publishing — sample price only.', 'draft', true, 'starting_price', 50000, 4, 7)
on conflict do nothing;

-- Essential / Signature / Premium tiers, duplicated from the Wedding
-- starter as the one reference example of the tier workflow (duplicate +
-- adjust, same action an admin uses for their own templates).
insert into package_templates (name, event_type, tier, description, status, is_starter, display_mode, base_price_cents, included_hours, position, duplicated_from)
select 'Wedding — Essential', 'wedding', 'essential', 'Lighter tier, duplicated from the Signature starter as a reference example.', 'draft', true, 'fixed_total', 120000, 4, 8, id
from package_templates where name = 'Wedding — Signature'
on conflict do nothing;

insert into package_templates (name, event_type, tier, description, status, is_starter, display_mode, base_price_cents, included_hours, position, duplicated_from)
select 'Wedding — Premium', 'wedding', 'premium', 'Fuller tier, duplicated from the Signature starter as a reference example.', 'draft', true, 'fixed_total', 260000, 6, 9, id
from package_templates where name = 'Wedding — Signature'
on conflict do nothing;

update package_templates set tier = 'signature' where name = 'Wedding — Signature' and tier is null;
