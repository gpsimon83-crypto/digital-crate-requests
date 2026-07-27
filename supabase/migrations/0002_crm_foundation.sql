-- CratesDJ back-office CRM: Clients, booking/contract fields on events,
-- Equipment & Inventory, and Staff Management extensions on djs.
--
-- Single-tenant by design (see project decision — this app runs one
-- business, not a multi-tenant SaaS platform, so no organization_id
-- anywhere here). Follows the existing schema's conventions: lowercase
-- snake_case, uuid_generate_v4(), RLS enabled with zero policies
-- (default-deny for anon/authenticated) — confirmed via direct anon-key
-- query against production that this, not "no RLS," is what djs/venues/
-- events/customers/song_requests actually do (schema.sql predates it and
-- was never updated). Every legitimate read/write already goes through
-- API routes on the service-role client, which bypasses RLS regardless,
-- so this only closes the anon-key-can-read-everything gap, it doesn't
-- change how the app itself talks to these tables.
--
-- invite_codes and platform_settings were found to be the exception —
-- genuinely open to the public anon key with zero policies, which meant
-- anyone could read valid unused DJ invite codes and self-register,
-- bypassing the invite gate entirely. Confirmed no client-side code reads
-- either table directly (only server API routes, via the admin client),
-- so locking them down here is a pure fix, not a functional change.
--
-- `clients` is deliberately separate from the existing `customers` table:
-- customers are event attendees/fans who request songs and earn reward
-- points; clients are the people/companies who hire Digital Crate DJs for
-- an event. Conflating them would corrupt both concepts.
--
-- `events` already models exactly what the roadmap called "Event
-- Booking" (dj_id, venue_id, status lifecycle, and an existing but never-
-- populated, unconstrained client_id column) — it's the DJ dashboard's
-- own "Bookings" view. Extended in place rather than duplicated into a
-- parallel bookings table.

-- ============================================
-- CLIENTS (the people/companies who book Digital Crate DJs)
-- ============================================
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  type text not null default 'individual', -- individual, corporate, venue, agency
  status text not null default 'active', -- active, inactive, blocked
  company_name text,
  first_name text,
  last_name text,
  email text,
  phone text,
  address_line1 text,
  address_line2 text,
  city text,
  state text,
  postal_code text,
  referral_source text,
  notes text,
  tags text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create index if not exists idx_clients_status on clients(status) where deleted_at is null;
create index if not exists idx_clients_email on clients(email) where deleted_at is null and email is not null;
create index if not exists idx_clients_tags on clients using gin(tags) where deleted_at is null;

-- ============================================
-- EVENTS: booking/contract/financial fields
-- ============================================
alter table events add column if not exists client_id uuid references clients(id) on delete set null;
alter table events add column if not exists event_type text; -- wedding, corporate, birthday, club, festival
alter table events add column if not exists service_type text; -- dj_only, dj_mc, full_production
alter table events add column if not exists expected_guests integer;
alter table events add column if not exists special_requests text;

alter table events add column if not exists quoted_amount numeric(10, 2);
alter table events add column if not exists final_amount numeric(10, 2);
alter table events add column if not exists deposit_amount numeric(10, 2);

alter table events add column if not exists contract_sent_at timestamptz;
alter table events add column if not exists contract_signed_at timestamptz;
alter table events add column if not exists contract_signed_by text;
alter table events add column if not exists contract_document_url text;

alter table events add column if not exists internal_notes text;

create index if not exists idx_events_client on events(client_id);

-- Existing status values in production: pending_confirmation, confirmed,
-- declined, live, ended. Not a CHECK constraint (status is free-text), so
-- the booking-lifecycle values below (inquiry, quoted, booked, canceled)
-- are additive vocabulary, not a migration — existing rows and app logic
-- keep working unchanged.

-- ============================================
-- VENUES: address + contact fields
-- ============================================
alter table venues add column if not exists address_line1 text;
alter table venues add column if not exists address_line2 text;
alter table venues add column if not exists city text;
alter table venues add column if not exists state text;
alter table venues add column if not exists postal_code text;
alter table venues add column if not exists contact_name text;
alter table venues add column if not exists contact_phone text;

-- ============================================
-- DJS: staff-management fields
-- ============================================
alter table djs add column if not exists specialties text[] default '{}'; -- weddings, corporate, clubs, mcee
alter table djs add column if not exists experience_years integer;
alter table djs add column if not exists hourly_rate numeric(10, 2);
alter table djs add column if not exists owns_equipment boolean default false;
alter table djs add column if not exists has_vehicle boolean default false;
alter table djs add column if not exists certifications text[] default '{}';
alter table djs add column if not exists emergency_contact_name text;
alter table djs add column if not exists emergency_contact_phone text;
alter table djs add column if not exists emergency_contact_relationship text;

-- ============================================
-- STAFF_AVAILABILITY (schema ready; no UI yet)
-- ============================================
create table if not exists staff_availability (
  id uuid primary key default uuid_generate_v4(),
  dj_id uuid not null references djs(id) on delete cascade,
  recurrence_type text not null, -- one_time, weekly, date_range
  date date,
  day_of_week integer, -- 0=Sunday .. 6=Saturday
  start_date date,
  end_date date,
  start_time time,
  end_time time,
  available boolean not null,
  reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_staff_avail_dj on staff_availability(dj_id);

-- ============================================
-- STAFF_PERFORMANCE_REVIEWS (schema ready; no UI yet)
-- ============================================
create table if not exists staff_performance_reviews (
  id uuid primary key default uuid_generate_v4(),
  dj_id uuid not null references djs(id) on delete cascade,
  event_id uuid references events(id) on delete set null,
  reviewed_by uuid references auth.users(id),
  rating integer not null,
  comments text,
  private_notes text,
  created_at timestamptz not null default now(),
  constraint valid_rating check (rating >= 1 and rating <= 5)
);

create index if not exists idx_staff_reviews_dj on staff_performance_reviews(dj_id, created_at desc);

-- ============================================
-- EVENT_STAFF_ASSIGNMENTS (multi-crew events; schema ready, no UI yet.
-- events.dj_id stays the lead/primary DJ for backward compatibility with
-- the existing DJ dashboard, this is supplementary crew.)
-- ============================================
create table if not exists event_staff_assignments (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  dj_id uuid not null references djs(id) on delete cascade,
  role text not null default 'assistant', -- lead_dj, dj, mc, technician, assistant
  status text not null default 'assigned', -- assigned, confirmed, declined, completed
  notes text,
  created_at timestamptz not null default now(),
  unique(event_id, dj_id, role)
);

create index if not exists idx_event_staff_event on event_staff_assignments(event_id);
create index if not exists idx_event_staff_dj on event_staff_assignments(dj_id);

-- ============================================
-- EQUIPMENT
-- ============================================
create table if not exists equipment (
  id uuid primary key default uuid_generate_v4(),
  category text not null, -- speakers, mixer, microphone, lights, cables, laptop
  name text not null,
  brand text,
  model text,
  serial_number text,
  status text not null default 'available', -- available, in_use, maintenance, retired
  condition text not null default 'excellent', -- excellent, good, fair, poor
  quantity_owned integer not null default 1,
  purchase_date date,
  purchase_price numeric(10, 2),
  current_value numeric(10, 2),
  last_maintenance_date date,
  next_maintenance_date date,
  storage_location text,
  photo_url text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint positive_quantity check (quantity_owned > 0)
);

create index if not exists idx_equipment_category on equipment(category) where deleted_at is null;
create index if not exists idx_equipment_status on equipment(status) where deleted_at is null;

-- ============================================
-- EQUIPMENT_MAINTENANCE_LOG
-- ============================================
create table if not exists equipment_maintenance_log (
  id uuid primary key default uuid_generate_v4(),
  equipment_id uuid not null references equipment(id) on delete cascade,
  maintenance_type text not null, -- routine, repair, calibration, inspection
  performed_at timestamptz not null,
  cost numeric(10, 2),
  description text,
  next_maintenance_date date,
  created_at timestamptz not null default now()
);

create index if not exists idx_equip_maint_equipment on equipment_maintenance_log(equipment_id, performed_at desc);

-- ============================================
-- EVENT_EQUIPMENT_ASSIGNMENTS
-- ============================================
create table if not exists event_equipment_assignments (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  equipment_id uuid not null references equipment(id) on delete cascade,
  quantity integer not null default 1,
  notes text,
  created_at timestamptz not null default now(),
  constraint positive_assignment_quantity check (quantity > 0)
);

create index if not exists idx_event_equip_event on event_equipment_assignments(event_id);
create index if not exists idx_event_equip_equipment on event_equipment_assignments(equipment_id);

-- ============================================
-- ROW LEVEL SECURITY
--
-- Enabled with zero policies on every new table — default-deny for anon
-- and authenticated, matching djs/venues/events/customers in production.
-- Nothing needs a policy added: every real read/write already goes
-- through an API route on the service-role client, which bypasses RLS
-- regardless of policies.
-- ============================================
alter table clients enable row level security;
alter table staff_availability enable row level security;
alter table staff_performance_reviews enable row level security;
alter table event_staff_assignments enable row level security;
alter table equipment enable row level security;
alter table equipment_maintenance_log enable row level security;
alter table event_equipment_assignments enable row level security;

-- ============================================
-- FIX: pre-existing anon-key exposure on invite_codes and
-- platform_settings (see header note above) — same default-deny pattern.
-- ============================================
alter table invite_codes enable row level security;
alter table platform_settings enable row level security;
