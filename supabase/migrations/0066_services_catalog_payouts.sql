-- Services catalog, DJ payout rules and DJ offers.
--
-- 1. Default project banner photo (platform_settings.default_project_cover).
-- 2. An editable catalog: event categories, packages linked to one or more
--    categories (one record can sit in several, like Live Band + DJ),
--    pricing type, add-ons linked to categories and to the packages that
--    include them.
-- 3. A DJ payout rule on every package (admin-only).
-- 4. DJ offers: the payout and scope a DJ accepts, with every version kept.
-- 5. New inquiries remember the package they asked about, frozen at the
--    price shown then.
-- 6. The November 2026 catalog revision, applied ONCE (catalog_revisions):
--    running this file again never duplicates records or overwrites edits
--    made afterwards on the Services page.
--
-- Additive only. Existing proposals, bookings, invoices and payouts keep
-- the amounts they already recorded: nothing here rewrites them.

-- 1 ---------------------------------------------------------------------
alter table platform_settings add column if not exists default_project_cover text;

-- 2 ---------------------------------------------------------------------
create table if not exists service_categories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,60}$'),
  name text not null check (char_length(name) between 1 and 60),
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table packages add column if not exists seed_key text;
alter table packages add column if not exists pricing_type text not null default 'fixed';
alter table packages add column if not exists quote_before_payment boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'packages_seed_key_key') then
    alter table packages add constraint packages_seed_key_key unique (seed_key);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'packages_pricing_type_check') then
    alter table packages add constraint packages_pricing_type_check check (pricing_type in ('fixed', 'starting_at', 'quote'));
  end if;
end $$;

-- 3 (payout rule; admin-only, never sent to clients or DJs) --------------
alter table packages add column if not exists payout_type text not null default 'percent';
alter table packages add column if not exists payout_percent numeric(5,2) not null default 55;
alter table packages add column if not exists payout_flat_cents integer;
-- The part of the price that is DJ service (bundles). Null = the whole price.
alter table packages add column if not exists eligible_service_cents integer;
-- Known third-party cost kept outside the payout base (e.g. a band fee), for the estimate only.
alter table packages add column if not exists third_party_fee_cents integer;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'packages_payout_type_check') then
    alter table packages add constraint packages_payout_type_check check (payout_type in ('percent', 'flat'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'packages_payout_values_check') then
    alter table packages add constraint packages_payout_values_check check (
      payout_percent between 0 and 100
      and (payout_flat_cents is null or payout_flat_cents between 0 and 10000000)
      and (eligible_service_cents is null or eligible_service_cents between 0 and 100000000)
      and (third_party_fee_cents is null or third_party_fee_cents between 0 and 100000000)
    );
  end if;
end $$;

alter table package_addons add column if not exists seed_key text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'package_addons_seed_key_key') then
    alter table package_addons add constraint package_addons_seed_key_key unique (seed_key);
  end if;
end $$;

-- Which categories a package shows in, and its order there.
create table if not exists package_category_links (
  package_id uuid not null references packages(id) on delete cascade,
  category_id uuid not null references service_categories(id) on delete cascade,
  position int not null default 0,
  primary key (package_id, category_id)
);
create index if not exists idx_package_category_links_category on package_category_links(category_id, position);

-- Which categories an add-on is offered in. An add-on with no rows here is offered in all of them.
create table if not exists addon_category_links (
  addon_id uuid not null references package_addons(id) on delete cascade,
  category_id uuid not null references service_categories(id) on delete cascade,
  primary key (addon_id, category_id)
);

-- Add-ons a package already includes: shown as "Included" and never charged twice.
create table if not exists package_included_addons (
  package_id uuid not null references packages(id) on delete cascade,
  addon_id uuid not null references package_addons(id) on delete cascade,
  primary key (package_id, addon_id)
);

create table if not exists catalog_revisions (
  key text primary key,
  applied_at timestamptz not null default now(),
  notes text
);

-- 4 ---------------------------------------------------------------------
create table if not exists dj_offers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  dj_id uuid references djs(id) on delete set null,
  package_id uuid references packages(id) on delete set null,
  kind text not null default 'one_time' check (kind in ('one_time', 'recurring')),
  -- Recurring: the residency dates this offer covers.
  gig_ids uuid[] not null default '{}',
  status text not null default 'draft' check (status in ('draft', 'offered', 'accepted', 'declined', 'withdrawn', 'superseded')),
  version int not null default 1,
  revises_offer_id uuid references dj_offers(id) on delete set null,
  -- What the DJ is paid: the whole gig (one_time) or each date (recurring). Required to send.
  payout_cents integer check (payout_cents is null or payout_cents between 0 and 10000000),
  -- Admin-only: how the payout was worked out, frozen when saved.
  client_price_cents integer,
  eligible_cents integer,
  third_party_fee_cents integer,
  sourced text not null default 'company' check (sourced in ('company', 'dj')),
  basis jsonb not null default '{}'::jsonb,
  -- What the DJ sees and agrees to: times, equipment, paid extras, notes.
  scope jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  responded_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dj_offer_sent_needs_payout check (status = 'draft' or status = 'withdrawn' or (payout_cents is not null and dj_id is not null))
);
create index if not exists idx_dj_offers_event on dj_offers(event_id, created_at desc);
create index if not exists idx_dj_offers_dj on dj_offers(dj_id, status);
-- One live offer per event per DJ chain: an event can't have two open offers to the same DJ.
create unique index if not exists idx_dj_offers_one_open on dj_offers(event_id, dj_id) where status = 'offered';

-- Payment status stays separate from the agreed payout.
alter table payouts add column if not exists offer_id uuid references dj_offers(id) on delete set null;

-- 5 ---------------------------------------------------------------------
alter table inquiry_submissions add column if not exists package_id uuid references packages(id) on delete set null;
alter table events add column if not exists package_id uuid references packages(id) on delete set null;
-- Name, price and terms as shown when they asked; later catalog edits don't change it.
alter table events add column if not exists package_snapshot jsonb;

alter table service_categories enable row level security;
alter table package_category_links enable row level security;
alter table addon_category_links enable row level security;
alter table package_included_addons enable row level security;
alter table catalog_revisions enable row level security;
alter table dj_offers enable row level security;
-- No policies: server-only, like the rest of the CRM.

-- 6 (runs once) ----------------------------------------------------------
do $$
declare
  rev constant text := 'services-2026-11';
  spec jsonb;
  pid uuid;
  cid uuid;
  uplight uuid;
  keeper uuid;
  pos int;
begin
  if exists (select 1 from catalog_revisions where key = rev) then
    return;
  end if;

  -- Categories (kept if they already exist).
  insert into service_categories (slug, name, position) values
    ('weddings', 'Weddings', 0),
    ('private-parties', 'Private Parties', 1),
    ('bars-nightlife', 'Bars & Nightlife', 2),
    ('school-events', 'School Events', 3),
    ('corporate-events', 'Corporate Events', 4)
  on conflict (slug) do nothing;

  -- Monograms and logo displays: off for new bookings. Rows stay, so
  -- anything already quoted, booked or invoiced with them is unchanged.
  update package_addons set is_active = false, updated_at = now() where name ~* '(monogram|gobo|logo)';
  update packages set is_active = false, updated_at = now() where name ~* '(monogram|gobo)';
  update packages set
      features = coalesce((select jsonb_agg(f) from jsonb_array_elements(features) f where f #>> '{}' !~* '(monogram|gobo|logo)'), '[]'::jsonb),
      updated_at = now()
    where features::text ~* '(monogram|gobo|logo)';
  update packages set
      description = btrim(regexp_replace(description, '[^.!?]*(monogram|gobo|logo)[^.!?]*[.!?]?\s*', '', 'gi')),
      updated_at = now()
    where description ~* '(monogram|gobo|logo)';
  update package_addons set
      description = btrim(regexp_replace(description, '[^.!?]*(monogram|gobo|logo)[^.!?]*[.!?]?\s*', '', 'gi'))
    where description ~* '(monogram|gobo|logo)' and is_active;
  if to_regclass('public.service_catalog_items') is not null then
    update service_catalog_items set is_active = false, updated_at = now() where name ~* '(monogram|gobo|logo)';
  end if;

  -- File existing packages into categories by name. Anything that doesn't
  -- match stays uncategorized (shown under "Not in a category").
  insert into package_category_links (package_id, category_id, position)
  select p.id, c.id, p.position from packages p join service_categories c on (
       (c.slug = 'weddings' and p.name ~* '(wedding|elite|hits|bridal|ceremony)')
    or (c.slug = 'bars-nightlife' and p.name ~* '(\mbar\M|bars|night|club|lounge|house sound|residen)')
    or (c.slug = 'school-events' and p.name ~* '(school|prom|homecoming)')
    or (c.slug = 'corporate-events' and p.name ~* '(corporate|gala|company)')
    or (c.slug = 'private-parties' and p.name ~* '(private|birthday)')
  )
  where p.name !~* 'live band'
  on conflict do nothing;

  -- Bars: flat payout. $275 on the $500 house-sound night.
  update packages p set payout_type = 'flat', payout_flat_cents = case when p.price = 500 then 27500 else round(p.price * 55) end
  where exists (select 1 from package_category_links l join service_categories c on c.id = l.category_id where l.package_id = p.id and c.slug = 'bars-nightlife');

  -- Live Band + DJ: one record everywhere it appears.
  select id into keeper from packages where name ~* 'live band' order by is_active desc, created_at limit 1;
  if keeper is null then
    insert into packages (name, description, price, hours, features, position, is_active)
    values ('Live Band + DJ', 'A live band with a DJ for the breaks and the rest of the night. Every booking is quoted for your date and band before payment.', 6500, null,
            '["Live band performance", "DJ & MC for breaks and the rest of the night", "Sound for band and DJ", "Coordination with the band"]'::jsonb, 90, true)
    returning id into keeper;
  end if;
  update packages set is_active = false, updated_at = now() where name ~* 'live band' and id <> keeper;
  update packages set seed_key = 'live-band-dj', pricing_type = 'starting_at', price = 6500, quote_before_payment = true,
         payout_type = 'percent', payout_percent = 55, eligible_service_cents = 270000, third_party_fee_cents = 300000, updated_at = now()
    where id = keeper;
  insert into package_category_links (package_id, category_id, position)
  select keeper, c.id, 90 from service_categories c where c.slug in ('weddings', 'private-parties', 'corporate-events')
  on conflict do nothing;

  -- Room uplighting add-on ($350): reuse the existing one, or add it.
  select id into uplight from package_addons where name ~* 'uplight' order by is_active desc, created_at limit 1;
  if uplight is null then
    insert into package_addons (name, description, price, position, seed_key)
    values ('Room Uplighting', 'Full-room intelligent wall-wash lighting.', 350, 50, 'room-uplighting')
    returning id into uplight;
  end if;

  -- The revised packages. A package with the same name is updated and
  -- adopted; otherwise it's added.
  pos := 0;
  for spec in select * from jsonb_array_elements($json$[
    {"key":"private-party-dj","cat":"private-parties","name":"Private Party DJ","price":950,"hours":4,"type":"fixed",
     "description":"A high-energy DJ & MC for your private party, with professional sound, a wireless mic and dance-floor lighting.",
     "features":["DJ & MC","Portable sound system","Wireless microphone","LED dance-floor lighting"]},
    {"key":"private-party-plus","cat":"private-parties","name":"Private Party Plus","price":1150,"hours":5,"type":"fixed",
     "description":"Everything in Private Party DJ, plus one more hour on the dance floor.",
     "features":["Everything in Private Party DJ","One more hour (5 hours in all)"]},
    {"key":"private-party-signature","cat":"private-parties","name":"Private Party Signature","price":1650,"hours":6,"type":"fixed","uplight":true,
     "description":"Everything in Private Party Plus, one more hour and room uplighting, for $50 less than adding them separately.",
     "features":["Everything in Private Party Plus","One more hour (6 hours in all)","Room uplighting"]},
    {"key":"school-dance-dj","cat":"school-events","name":"School Dance DJ","price":1200,"hours":4,"type":"fixed",
     "description":"A DJ & MC who plays clean music and school-approved requests, with sound, a wireless mic and dance-floor lighting.",
     "features":["DJ & MC","Clean music only","School-approved requests","Sound system","Wireless microphone","LED dance-floor lighting"]},
    {"key":"prom-homecoming-dj","cat":"school-events","name":"Prom & Homecoming DJ","price":1550,"hours":5,"type":"fixed",
     "description":"Everything in School Dance DJ, plus one more hour and enhanced dance-floor lighting.",
     "features":["Everything in School Dance DJ","One more hour (5 hours in all)","Enhanced dance-floor lighting"]},
    {"key":"large-school-event-dj","cat":"school-events","name":"Large School Event DJ","price":2100,"hours":5,"type":"starting_at","uplight":true,
     "description":"Everything in Prom & Homecoming DJ, with expanded sound coverage and room uplighting. Final price is confirmed by attendance and venue size.",
     "features":["Everything in Prom & Homecoming DJ","Up to 5 hours","Expanded sound coverage","Room uplighting"]},
    {"key":"corporate-event-dj-mc","cat":"corporate-events","name":"Corporate Event DJ & MC","price":1600,"hours":5,"type":"fixed",
     "description":"Arrival and dinner music, wireless mics, awards and announcements, walk-up cues and dancing.",
     "features":["Arrival and dinner music","Wireless microphones","Awards and announcements","Walk-up cues","Dancing"]},
    {"key":"corporate-gala-dj-mc","cat":"corporate-events","name":"Corporate Gala DJ & MC","price":2150,"hours":6,"type":"fixed","uplight":true,
     "description":"Everything in Corporate Event DJ & MC, plus one more hour, room uplighting and a run-of-show review before the event.",
     "features":["Everything in Corporate Event DJ & MC","One more hour (6 hours in all)","Room uplighting","Pre-event run-of-show review"]}
  ]$json$::jsonb) loop
    select id into pid from packages where seed_key = spec->>'key';
    if pid is null then
      select id into pid from packages where seed_key is null and lower(name) = lower(spec->>'name') order by created_at limit 1;
    end if;
    if pid is null then
      insert into packages (name, description, price, hours, features, position, is_active, seed_key, pricing_type, payout_type, payout_percent)
      values (spec->>'name', spec->>'description', (spec->>'price')::numeric, (spec->>'hours')::numeric, spec->'features', 10 + pos, true,
              spec->>'key', spec->>'type', 'percent', 55)
      returning id into pid;
    else
      update packages set name = spec->>'name', description = spec->>'description', price = (spec->>'price')::numeric,
             hours = (spec->>'hours')::numeric, features = spec->'features', is_active = true, seed_key = spec->>'key',
             pricing_type = spec->>'type', payout_type = 'percent', payout_percent = 55, updated_at = now()
       where id = pid;
    end if;
    select id into cid from service_categories where slug = spec->>'cat';
    insert into package_category_links (package_id, category_id, position) values (pid, cid, pos)
      on conflict (package_id, category_id) do update set position = excluded.position;
    if (spec->>'uplight')::boolean is true then
      insert into package_included_addons (package_id, addon_id) values (pid, uplight) on conflict do nothing;
    end if;
    pos := pos + 1;
  end loop;

  insert into catalog_revisions (key, notes) values (rev, 'Categories, revised Private Party / School / Corporate packages, Live Band + DJ as one record, monograms off for new bookings, starting payout rules.');
end $$;
