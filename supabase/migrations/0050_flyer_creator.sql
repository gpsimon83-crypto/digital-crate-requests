-- Flyer Creator (DJ portal).
--
-- Templates are built by staff and published as numbered, immutable
-- versions; a DJ's flyer (design) keeps a pointer to the exact version it
-- was started from, so publishing a new version never changes existing
-- drafts. A design stores the editable scene (layers as JSON), not a
-- flattened image: exports are made in the browser from that scene.
--
-- Uploaded images live in the private "flyer-assets" bucket and are served
-- through /api/flyers/assets/... after an access check:
--   * template / library assets: any DJ or staff
--   * a DJ's own uploads: that DJ and staff only
--
-- Like the other tables here, only the server (service role) reads and
-- writes these; RLS is on with no policies.

create table if not exists flyer_templates (
  id uuid primary key default uuid_generate_v4(),
  slug text unique,
  name text not null check (char_length(name) between 1 and 80),
  description text check (description is null or char_length(description) <= 300),
  venue_id uuid references venues(id) on delete set null,
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  -- The working copy staff edit: { formats: { square?: Scene, portrait?: Scene, story?: Scene } }
  draft jsonb not null default '{"formats":{}}'::jsonb,
  current_version_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists flyer_template_versions (
  id uuid primary key default uuid_generate_v4(),
  template_id uuid not null references flyer_templates(id) on delete restrict,
  version integer not null check (version > 0),
  -- Frozen copy of the template at publish time: { formats: { ... } }
  content jsonb not null,
  published_by uuid references auth.users(id) on delete set null,
  published_at timestamptz not null default now(),
  unique (template_id, version)
);
create index if not exists idx_flyer_template_versions_template on flyer_template_versions (template_id, version desc);

do $$ begin
  alter table flyer_templates
    add constraint flyer_templates_current_version_fk
    foreign key (current_version_id) references flyer_template_versions(id) on delete set null;
exception when duplicate_object then null; end $$;

create table if not exists flyer_designs (
  id uuid primary key default uuid_generate_v4(),
  dj_id uuid not null references djs(id) on delete cascade,
  template_id uuid references flyer_templates(id) on delete set null,
  template_version_id uuid references flyer_template_versions(id) on delete restrict,
  event_id uuid references events(id) on delete set null,
  title text not null default 'Untitled flyer' check (char_length(title) <= 80),
  format text not null check (format in ('square', 'portrait', 'story')),
  width integer not null check (width between 100 and 4000),
  height integer not null check (height between 100 and 4000),
  scene jsonb not null,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_flyer_designs_dj on flyer_designs (dj_id, updated_at desc);

create table if not exists flyer_assets (
  id uuid primary key default uuid_generate_v4(),
  -- 'template' = background/overlay/logo used by templates; 'dj' = a DJ's own upload
  scope text not null check (scope in ('template', 'dj')),
  kind text not null check (kind in ('background', 'overlay', 'logo', 'photo', 'image')),
  owner_dj_id uuid references djs(id) on delete cascade,
  name text check (name is null or char_length(name) <= 120),
  storage_path text not null unique,
  mime text not null check (mime in ('image/png', 'image/jpeg', 'image/webp')),
  bytes integer not null check (bytes > 0),
  width integer not null check (width > 0),
  height integer not null check (height > 0),
  has_alpha boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check ((scope = 'dj') = (owner_dj_id is not null))
);
create index if not exists idx_flyer_assets_owner on flyer_assets (owner_dj_id, created_at desc);
create index if not exists idx_flyer_assets_scope on flyer_assets (scope, kind);

alter table flyer_templates enable row level security;
alter table flyer_template_versions enable row level security;
alter table flyer_designs enable row level security;
alter table flyer_assets enable row level security;

insert into storage.buckets (id, name, public)
values ('flyer-assets', 'flyer-assets', false)
on conflict (id) do update set public = false;
