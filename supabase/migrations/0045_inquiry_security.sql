-- Inquiry, booking and account security (2026-11-11).
--
-- Additive and backward compatible: no existing lead, client, event or
-- payment row is deleted or changed, except the one-time copy of staff
-- roles into app_metadata at the bottom (see the note there).
--
-- Public inquiries no longer write to `events` the moment the form is
-- submitted. They land in `inquiry_submissions` as "pending verification",
-- and only become a normal lead (an `events` row with status 'inquiry')
-- after the person confirms their email (and, if flagged, an admin
-- approves it). Inquiry status therefore lives here and stays separate
-- from booking status on `events`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
-- Pending / reviewed public submissions
-- ---------------------------------------------------------------------
create table if not exists inquiry_submissions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  kind text not null default 'inquiry' check (kind in ('inquiry', 'consultation')),
  source text not null default 'website' check (source in ('website', 'wordpress', 'scheduler')),
  status text not null default 'pending_verification'
    check (status in ('pending_verification', 'verified', 'needs_review', 'spam', 'archived')),
  -- Client-generated id for this form fill, so a retried POST is a no-op.
  idempotency_key text,
  name text not null,
  email text not null,
  email_normalized text not null,
  phone text,
  event_date date,
  event_type text,
  preferred_dj_id uuid references djs(id) on delete set null,
  venue_name text,
  expected_guests integer,
  budget_range text,
  message text,
  -- Consultation requests (scheduler): the requested call slot.
  slot_start timestamptz,
  slot_end timestamptz,
  -- Signals. Hashes only — no raw IP address or user agent is stored.
  message_hash text,
  source_hash text,
  completion_ms integer,
  risk_score integer not null default 0,
  risk_reasons jsonb not null default '[]'::jsonb,
  -- Email verification. Only a SHA-256 hash of the token is stored.
  verification_token_hash text unique,
  verification_expires_at timestamptz,
  verification_sent_count integer not null default 0,
  last_verification_sent_at timestamptz,
  verified_at timestamptz,
  -- Activation (turning it into a real lead) is claimed once, atomically.
  activation_claimed_at timestamptz,
  activated_at timestamptz,
  event_id uuid references events(id) on delete set null,
  -- Manual review
  reviewed_by uuid,
  reviewed_by_label text,
  reviewed_at timestamptz,
  review_note text
);

create unique index if not exists inquiry_submissions_idempotency_key
  on inquiry_submissions(idempotency_key) where idempotency_key is not null;
create index if not exists inquiry_submissions_email_idx on inquiry_submissions(email_normalized, created_at desc);
create index if not exists inquiry_submissions_status_idx on inquiry_submissions(status, created_at desc);
create index if not exists inquiry_submissions_source_idx on inquiry_submissions(source_hash, created_at desc);
create index if not exists inquiry_submissions_message_idx on inquiry_submissions(message_hash, created_at desc) where message_hash is not null;

-- ---------------------------------------------------------------------
-- Consultation slot holds: an unverified scheduler request holds its slot
-- (so two people can't take it) without creating a calendar event. The
-- primary key makes a slot holdable by only one request at a time.
-- ---------------------------------------------------------------------
create table if not exists consultation_holds (
  slot_start timestamptz primary key,
  slot_end timestamptz not null,
  submission_id uuid not null references inquiry_submissions(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create or replace function claim_consultation_hold(p_slot_start timestamptz, p_slot_end timestamptz, p_submission uuid, p_expires timestamptz)
returns boolean
language plpgsql
as $$
declare
  inserted integer;
begin
  delete from consultation_holds where slot_start = p_slot_start and expires_at <= now();
  insert into consultation_holds(slot_start, slot_end, submission_id, expires_at)
  values (p_slot_start, p_slot_end, p_submission, p_expires)
  on conflict (slot_start) do nothing;
  get diagnostics inserted = row_count;
  return inserted = 1;
end;
$$;

-- Two confirmed consultation calls can never share a start time. Created
-- only when existing data has no duplicates, so the migration can't fail
-- on old rows.
do $$
begin
  if not exists (
    select 1 from events
    where event_type = 'consultation' and status <> 'declined' and starts_at is not null
    group by starts_at having count(*) > 1
  ) then
    create unique index if not exists events_consultation_slot_unique
      on events(starts_at) where event_type = 'consultation' and status <> 'declined';
  end if;
end $$;

-- ---------------------------------------------------------------------
-- Persistent rate limiting (fixed window, atomic upsert)
-- ---------------------------------------------------------------------
create table if not exists security_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

create or replace function security_rate_limit_hit(p_bucket text, p_limit integer, p_window_seconds integer)
returns table(allowed boolean, hits integer, retry_after_seconds integer)
language plpgsql
as $$
declare
  w timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  h integer;
begin
  insert into security_rate_limits as r (bucket, window_start, hits)
  values (p_bucket, w, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into h;
  return query select
    h <= p_limit,
    h,
    greatest(1, ceil(extract(epoch from (w + make_interval(secs => p_window_seconds) - now())))::integer);
end;
$$;

-- ---------------------------------------------------------------------
-- Temporary email / source blocks set by admins (never permanent)
-- ---------------------------------------------------------------------
create table if not exists security_blocks (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('email', 'source')),
  value_hash text not null,
  label text not null,
  reason text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  created_by uuid,
  created_by_label text,
  removed_at timestamptz,
  removed_by uuid,
  removed_by_label text
);
create index if not exists security_blocks_active_idx on security_blocks(kind, value_hash) where removed_at is null;

-- ---------------------------------------------------------------------
-- Security action history (no tokens, passwords, links or message bodies)
-- ---------------------------------------------------------------------
create table if not exists security_events (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  action text not null,
  actor_user_id uuid,
  actor_label text,
  submission_id uuid references inquiry_submissions(id) on delete set null,
  details jsonb not null default '{}'::jsonb
);
create index if not exists security_events_created_idx on security_events(created_at desc);
create index if not exists security_events_action_idx on security_events(action, created_at desc);

-- One-time tokens already spent (Turnstile tokens, SSO links).
create table if not exists security_used_tokens (
  token_hash text primary key,
  purpose text not null,
  used_at timestamptz not null default now()
);

-- Webhook deliveries already processed (Stripe redelivers).
create table if not exists processed_webhook_events (
  provider text not null,
  event_id text not null,
  status text not null default 'processing' check (status in ('processing', 'done')),
  processed_at timestamptz not null default now(),
  primary key (provider, event_id)
);

-- ---------------------------------------------------------------------
-- Atomic booking confirmation: an assigned DJ can't end up with two
-- overlapping confirmed bookings because two people clicked Confirm at
-- once. Serialised per DJ with a transaction-scoped advisory lock.
-- Events without an end time are treated as 5 hours long.
-- ---------------------------------------------------------------------
create or replace function confirm_event_guarded(p_event_id uuid, p_allow_overlap boolean default false)
returns table(result text, conflict_event_id uuid)
language plpgsql
as $$
declare
  v_dj uuid;
  e record;
  c uuid;
begin
  select dj_id into v_dj from events where id = p_event_id;
  if not found then
    return query select 'not_found'::text, null::uuid; return;
  end if;
  if v_dj is not null then
    perform pg_advisory_xact_lock(hashtext('dj-confirm:' || v_dj::text));
  end if;
  select * into e from events where id = p_event_id for update;
  if e.status in ('confirmed', 'live') then
    return query select 'already'::text, null::uuid; return;
  end if;
  if e.dj_id is not null and e.starts_at is not null and not p_allow_overlap then
    select o.id into c from events o
    where o.dj_id = e.dj_id and o.id <> e.id and o.status in ('confirmed', 'live') and o.starts_at is not null
      and o.starts_at < coalesce(e.ends_at, e.starts_at + interval '5 hours')
      and coalesce(o.ends_at, o.starts_at + interval '5 hours') > e.starts_at
    limit 1;
    if c is not null then
      return query select 'conflict'::text, c; return;
    end if;
  end if;
  update events set status = 'confirmed', event_status = 'confirmed' where id = p_event_id;
  return query select 'confirmed'::text, null::uuid;
end;
$$;

-- ---------------------------------------------------------------------
-- Retention (run daily by /api/cron/security-maintenance)
-- ---------------------------------------------------------------------
create or replace function security_maintenance(p_submission_days integer, p_log_days integer)
returns jsonb
language plpgsql
as $$
declare
  released integer; expired integer; purged integer; logs integer;
begin
  delete from consultation_holds where expires_at <= now();
  get diagnostics released = row_count;

  -- Verification window passed without a confirmation: archive (kept for review, not deleted yet).
  update inquiry_submissions set status = 'archived', updated_at = now()
  where status = 'pending_verification' and verification_expires_at < now() - interval '1 day';
  get diagnostics expired = row_count;

  -- Personal data from submissions that never became a lead is removed after the retention period.
  delete from inquiry_submissions
  where event_id is null and status in ('archived', 'spam') and updated_at < now() - make_interval(days => p_submission_days);
  get diagnostics purged = row_count;

  delete from security_events where created_at < now() - make_interval(days => p_log_days);
  get diagnostics logs = row_count;

  delete from security_rate_limits where window_start < now() - interval '2 days';
  delete from security_used_tokens where used_at < now() - interval '7 days';
  delete from processed_webhook_events where processed_at < now() - interval '90 days';

  return jsonb_build_object('released_holds', released, 'archived_unverified', expired, 'purged_submissions', purged, 'purged_logs', logs);
end;
$$;

-- These tables are only ever touched by the server's service-role client.
alter table inquiry_submissions enable row level security;
alter table consultation_holds enable row level security;
alter table security_rate_limits enable row level security;
alter table security_blocks enable row level security;
alter table security_events enable row level security;
alter table security_used_tokens enable row level security;
alter table processed_webhook_events enable row level security;

revoke all on function claim_consultation_hold(timestamptz, timestamptz, uuid, timestamptz) from public, anon, authenticated;
revoke all on function security_rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke all on function confirm_event_guarded(uuid, boolean) from public, anon, authenticated;
revoke all on function security_maintenance(integer, integer) from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- Staff roles move to app_metadata.
--
-- Until now the app read an account's role from user_metadata, which the
-- account holder can change from the browser (supabase.auth.updateUser).
-- The app now reads app_metadata.role, which only the server can set.
-- This copies the current staff/DJ roles across once so nobody loses
-- access. Review the list in Admin → Inquiry Security → Staff accounts
-- afterwards: any account that set its own role before this change would
-- have been copied too.
-- ---------------------------------------------------------------------
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', raw_user_meta_data ->> 'role')
where raw_user_meta_data ->> 'role' in ('owner', 'admin', 'manager', 'dj')
  and coalesce(raw_app_meta_data ->> 'role', '') = '';
