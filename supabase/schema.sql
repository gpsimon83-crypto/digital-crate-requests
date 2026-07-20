-- Digital Crate DJs / Digital Crate Requests platform schema

create extension if not exists "uuid-ossp";

-- ============ CORE ENTITIES ============

create table if not exists djs (
  id uuid primary key default uuid_generate_v4(),
  display_name text not null,
  bio text,
  photo_url text,
  event_types text[] default '{}',
  top_genres text[] default '{}',
  tip_link text,
  socials jsonb default '{}',
  auth_user_id uuid unique references auth.users(id) on delete set null,
  hero_settings jsonb default '{"xPosition":75,"yPosition":50,"zoom":100,"overlayDarkness":40}',
  created_at timestamptz default now()
);

create table if not exists venues (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  location text,
  photos text[] default '{}',
  created_at timestamptz default now()
);

create table if not exists venue_djs (
  venue_id uuid references venues(id) on delete cascade,
  dj_id uuid references djs(id) on delete cascade,
  primary key (venue_id, dj_id)
);

create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  event_code text unique not null,
  dj_id uuid references djs(id),
  venue_id uuid references venues(id),
  client_id uuid,
  title text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text default 'pending_confirmation', -- pending_confirmation | confirmed | declined | live | ended
  must_play jsonb default '[]',
  do_not_play jsonb default '[]',
  guest_request_settings jsonb default '{}',
  hero_image_url text,
  created_at timestamptz default now()
);

-- ============ CRM ============

create table if not exists customers (
  id uuid primary key default uuid_generate_v4(),
  full_name text,
  phone text,
  email text,
  birthday date,
  favorite_genres text[] default '{}',
  favorite_djs uuid[] default '{}',
  favorite_venues uuid[] default '{}',
  marketing_opt_in boolean default false,
  reward_points integer default 0,
  created_at timestamptz default now()
);

-- ============ CRATE REQUESTS ============

create table if not exists song_requests (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  customer_id uuid references customers(id),
  song_title text not null,
  artist text,
  status text default 'pending', -- pending | approved | declined | played
  is_paid boolean default false,
  payment_intent_id text,
  payment_status text default 'none', -- none | authorized | captured | canceled
  amount_cents integer default 0,
  vote_count integer default 0,
  boost_total_cents integer default 0,
  bpm integer,
  genre text,
  energy_level text,
  explicit boolean default false,
  crate_match jsonb default '{}', -- owned_by_dj, missing_from_crate, clean_version, intro_edit, remix
  created_at timestamptz default now()
);

create table if not exists votes (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid references song_requests(id) on delete cascade,
  customer_id uuid references customers(id),
  created_at timestamptz default now(),
  unique (request_id, customer_id)
);

create table if not exists boosts (
  id uuid primary key default uuid_generate_v4(),
  request_id uuid references song_requests(id) on delete cascade,
  customer_id uuid references customers(id),
  amount_cents integer not null,
  payment_intent_id text,
  created_at timestamptz default now()
);

create table if not exists tips (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  dj_id uuid references djs(id),
  customer_id uuid references customers(id),
  amount_cents integer not null,
  message text,
  payment_intent_id text,
  created_at timestamptz default now()
);

-- ============ LIVE FEED / PULSE ============

create table if not exists feed_events (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  type text not null, -- request | tip | boost | played | announcement | crowd_favorite
  payload jsonb default '{}',
  created_at timestamptz default now()
);

create table if not exists pulse_snapshots (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid references events(id) on delete cascade,
  crowd_energy numeric,
  top_genres text[] default '{}',
  most_requested jsonb default '[]',
  hot_songs jsonb default '[]',
  suggested_next jsonb default '[]',
  created_at timestamptz default now()
);

-- ============ REWARDS ============

create table if not exists reward_events (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade,
  action text not null, -- profile_created | request | tip | vote | boost | attendance
  points integer not null,
  created_at timestamptz default now()
);

create table if not exists reward_redemptions (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete cascade,
  reward_type text not null, -- vip_request | priority_request | free_request | merch_discount | event_discount
  points_spent integer not null,
  redeemed_at timestamptz default now()
);

-- ============ ADMIN / PLATFORM SETTINGS ============

create table if not exists invite_codes (
  id uuid primary key default uuid_generate_v4(),
  code text unique not null,
  assigned_dj_id uuid references djs(id) on delete set null,
  used boolean default false,
  created_at timestamptz default now()
);

create table if not exists platform_settings (
  id boolean primary key default true, -- single-row table
  allow_dj_self_registration boolean default true,
  require_disclaimer_acceptance boolean default true,
  crowd_vote_boosts_enabled boolean default true,
  push_notifications_enabled boolean default false,
  constraint platform_settings_singleton check (id)
);

create table if not exists pricing_settings (
  id boolean primary key default true, -- single-row table
  config jsonb not null default '{}',
  constraint pricing_settings_singleton check (id)
);

insert into pricing_settings (id) values (true) on conflict (id) do nothing;

insert into platform_settings (id) values (true) on conflict (id) do nothing;

-- ============ INDEXES ============

create index if not exists idx_requests_event on song_requests(event_id);
create index if not exists idx_feed_event on feed_events(event_id, created_at desc);
create index if not exists idx_votes_request on votes(request_id);

-- ============ FUNCTIONS ============

create or replace function increment_vote_count(req_id uuid)
returns song_requests
language plpgsql
as $$
declare
  updated song_requests;
begin
  update song_requests
  set vote_count = vote_count + 1
  where id = req_id
  returning * into updated;
  return updated;
end;
$$;

-- ============ CRATE BUILDER: shared track metadata cache ============
-- Populated by the Crate Builder metadata agent (ID3 tags read client-side,
-- gaps filled via Spotify search). Shared across DJs/computers so the same
-- track is never re-looked-up twice. Keyed by a normalized "artist - title"
-- string, not a track file, since the same song can live in many files.

create table if not exists track_metadata (
  key text primary key,
  artist text,
  title text,
  genre text,
  year int,
  energy_tier text, -- 'warmup' | 'smooth' | 'moderate' | 'high_energy' | 'unknown'
  energy_score int,  -- 0-100 heuristic estimate, not measured
  source text not null default 'heuristic', -- 'id3' | 'spotify' | 'heuristic'
  updated_at timestamptz not null default now()
);

create index if not exists idx_track_metadata_genre on track_metadata(genre);
create index if not exists idx_track_metadata_year on track_metadata(year);

-- ============ CRATE BUILDER: song tags (Phase 1) ============
-- Flexible per-song tagging, keyed the same way as track_metadata (normalized
-- "artist::title"), so a song's genre/era/function/etc. tags are shared
-- across every DJ's drive that has that song, same as the existing ID3/
-- Spotify metadata cache. No foreign key to track_metadata (a tag can be
-- added before that row exists); same key format enforced by convention.

create table if not exists track_tags (
  id uuid primary key default uuid_generate_v4(),
  track_key text not null,
  tag_type text not null,   -- 'genre' | 'era' | 'song_function' | 'crowd_fit' | 'vocal_type' | 'content_rating' | 'crate_status'
  tag_value text not null,
  created_at timestamptz not null default now(),
  unique (track_key, tag_type, tag_value)
);

create index if not exists idx_track_tags_key on track_tags(track_key);
create index if not exists idx_track_tags_type_value on track_tags(tag_type, tag_value);

-- ============ CRATE BUILDER: crate profiles (Phase 1) ============
-- A crate's real track list always lives in the DJ's local .crate file.
-- This table is a "shadow" record (matched by DJ + crate name) holding the
-- new metadata layered on top: guided-setup answers, organization category,
-- and Elite status/sharing. song_keys is a snapshot (artist/title keys) of
-- what was in the crate at last save, used only for cross-DJ Elite Pack
-- matching — never the source of truth for a DJ's own crate.

create table if not exists crate_profiles (
  id uuid primary key default uuid_generate_v4(),
  dj_id uuid references djs(id) on delete cascade,
  name text not null,               -- matches the local .crate filename, no extension
  category text,                    -- Elite Crates | Event Crates | Genre Crates | Era Crates |
                                     -- Energy Crates | Venue Crates | DJ Tool Crates |
                                     -- Request-Based Crates | Seasonal Crates | Personal DJ Crates |
                                     -- Shared Team Crates | Archived Crates
  subcategory text,                 -- optional, e.g. "Warm-Up" under Energy Crates
  is_elite boolean not null default false,
  elite_category text,              -- e.g. "Elite Wedding Weapons"
  elite_source text not null default 'dj_curated', -- 'dj_curated' | 'admin_curated' | 'system_suggested' (Phase 2)
  is_shared boolean not null default false,         -- owner opted in to share with the team
  guided_setup jsonb,               -- event_type, venue_id, crowd_age_range, clean_requirement,
                                     -- preferred_genres[], preferred_eras[], desired_energy,
                                     -- crate_size, event_duration_minutes, dj_id_assigned
  song_keys jsonb not null default '[]', -- [{key, artist, title}], snapshot at last save
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dj_id, name)
);

create index if not exists idx_crate_profiles_dj on crate_profiles(dj_id);
create index if not exists idx_crate_profiles_category on crate_profiles(category);
create index if not exists idx_crate_profiles_shared_elite on crate_profiles(is_elite, is_shared);

-- ============ CRATE BUILDER: Phase 2 additions ============

-- Energy Flow section assignment ([{key, section}] in order) and
-- suggestion dismissals ("never suggest for this crate") layered onto the
-- existing crate_profiles shadow record.
alter table crate_profiles add column if not exists energy_sections jsonb not null default '[]';
alter table crate_profiles add column if not exists dismissed_keys jsonb not null default '[]';

-- Per-DJ private song ratings/performance notes, keyed the same way as
-- track_tags (normalized "artist::title"). Not shared across DJs yet —
-- visibility controls are a later phase.
create table if not exists song_ratings (
  id uuid primary key default uuid_generate_v4(),
  dj_id uuid references djs(id) on delete cascade,
  track_key text not null,
  stars int,                 -- 1-5
  crowd_reaction int,        -- 1-10
  feedback_tags text[] not null default '{}', -- 'Strong Opener' | 'Overplayed' | 'Retire Song' | etc.
  notes text,
  updated_at timestamptz not null default now(),
  unique (dj_id, track_key)
);
create index if not exists idx_song_ratings_dj on song_ratings(dj_id);

-- Admin-manageable crate templates: recommended genre/era/energy balance
-- to guide a new crate, never actual songs (no copyrighted content is
-- auto-added by picking a template).
create table if not exists crate_templates (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  description text,
  event_type text,
  target_genres text[] not null default '{}',
  target_eras text[] not null default '{}',
  target_energy_distribution jsonb not null default '{}', -- {"Warm-Up":20,"Groove":30,"Peak":30,"Closing":20}
  clean_requirement text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
