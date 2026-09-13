-- crate_templates was defined in schema.sql but never actually migrated to
-- the live database, so GET /api/admin/crate-templates 404s and the admin
-- Crate Templates page hangs on "Loading..." forever with the error hidden.
create table if not exists crate_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  event_type text,
  target_genres text[] not null default '{}',
  target_eras text[] not null default '{}',
  target_energy_distribution jsonb not null default '{}',
  clean_requirement text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table crate_templates enable row level security;
