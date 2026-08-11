-- Threaded email between staff/DJs and clients, scoped per-project (one
-- thread per event — no separate "threads" table needed since a project
-- only ever has one ongoing client conversation in this model).
--
-- Sending goes through Resend. Inbound replies are routed back to the
-- right event WITHOUT a separate thread-key column: each event's
-- event_code (already unique) is used as the local part of a dedicated
-- reply-to address, e.g. CASEY-0704@reply.cratesdjs.com. The inbound
-- webhook parses event_code back out of the `to` address to find event_id.
--
-- Permissions (enforced in the API layer, not here): admin/staff can see
-- every thread; a DJ can only see threads for events where events.dj_id
-- is their own — same scoping already used for DJ Bookings.
create table if not exists email_messages (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  direction text not null check (direction in ('outbound', 'inbound')),
  from_email text not null,
  from_name text,
  to_email text not null,
  subject text,
  body text not null,
  resend_message_id text,
  sent_by_user_id uuid references auth.users(id) on delete set null,
  seen_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_email_messages_event on email_messages(event_id, created_at);
create index if not exists idx_email_messages_resend_id on email_messages(resend_message_id);

alter table email_messages enable row level security;
-- No policies — same pattern as every other table here: all real access
-- goes through Next.js API routes using the service-role admin client,
-- which bypasses RLS. RLS is enabled with zero policies purely so the
-- table isn't publicly readable via the anon key by accident.
