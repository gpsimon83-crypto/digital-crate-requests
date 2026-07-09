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
