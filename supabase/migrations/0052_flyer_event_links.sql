-- Flyer Creator upgrade: event-linked flyers, template activation, DJ
-- cutouts and name logos, venue drink-special defaults.
-- Additive only: existing templates, flyers and images keep working as-is.

-- 1. Template activation (which template a new flyer starts from).
--    Resolved in this order: event override → venue default → company default.
create table if not exists flyer_template_activations (
  id uuid primary key default uuid_generate_v4(),
  scope text not null check (scope in ('company', 'venue', 'event')),
  venue_id uuid references venues(id) on delete cascade,
  event_id uuid references events(id) on delete cascade,
  template_id uuid not null references flyer_templates(id) on delete cascade,
  activated_by uuid references auth.users(id) on delete set null,
  activated_at timestamptz not null default now(),
  check ((scope = 'company' and venue_id is null and event_id is null)
      or (scope = 'venue' and venue_id is not null and event_id is null)
      or (scope = 'event' and event_id is not null))
);
create unique index if not exists flyer_activation_company on flyer_template_activations (scope) where scope = 'company';
create unique index if not exists flyer_activation_venue on flyer_template_activations (venue_id) where scope = 'venue';
create unique index if not exists flyer_activation_event on flyer_template_activations (event_id) where scope = 'event';
alter table flyer_template_activations enable row level security;

-- 2. DJ cutouts (transparent portraits) and name logos live in the existing
--    image library as two new image types, approved by staff, one preferred per DJ.
alter table flyer_assets drop constraint if exists flyer_assets_kind_check;
alter table flyer_assets add constraint flyer_assets_kind_check check (kind in ('background', 'overlay', 'logo', 'photo', 'image', 'cutout', 'name_logo'));
alter table flyer_assets add column if not exists approved boolean not null default true;
alter table flyer_assets add column if not exists is_primary boolean not null default false;
create unique index if not exists flyer_assets_one_primary on flyer_assets (owner_dj_id, kind) where is_primary and owner_dj_id is not null;

-- 3. Venue-wide drink specials; a night's own specials (venue_night_plans) override them.
alter table venues add column if not exists default_drink_specials text check (default_drink_specials is null or char_length(default_drink_specials) <= 600);

-- 4. What a flyer is linked to. The event stays the source of truth for its
--    venue and DJs; venue_id is only used for flyers without an event.
--    dj_slots: which DJ fills slot 1, 2, … (defaults to the event's DJs).
--    exported_at: set when the flyer is exported; applying a newly activated
--    template never touches exported flyers.
alter table flyer_designs add column if not exists venue_id uuid references venues(id) on delete set null;
alter table flyer_designs add column if not exists dj_slots jsonb;
alter table flyer_designs add column if not exists exported_at timestamptz;
