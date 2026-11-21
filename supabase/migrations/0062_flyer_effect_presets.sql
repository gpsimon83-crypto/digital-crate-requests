-- Flyer Creator · Photo Effects: custom presets a person saves from the
-- effects panel (their own; reusable on any flyer). Flyers keep their own
-- copy of the settings on each photo layer, so deleting a preset never
-- changes a saved flyer. Server-only (RLS on, no policies).

create table if not exists flyer_effect_presets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  -- the versioned effects config (preset, strength, params, seed, mask)
  effects jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);
create index if not exists idx_flyer_effect_presets_user on flyer_effect_presets (user_id, created_at desc);
alter table flyer_effect_presets enable row level security;
