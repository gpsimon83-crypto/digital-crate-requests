-- Communications Center: designed (HTML) emails that admins build in the
-- Email Studio and send to clients through Resend.
--
-- comm_email_designs      saved designs / templates (blocks JSON + theme)
-- comm_email_sends        one row per send (the exact subject + design used)
-- comm_email_recipients   one row per recipient with real delivery status,
--                         updated from Resend's webhook
-- comm_email_suppressions addresses that bounced, complained or asked to
--                         stop; skipped on every future send
--
-- Same access pattern as the rest of the CRM: RLS on with no policies, all
-- reads/writes go through admin API routes using the service-role client.

create table if not exists comm_email_designs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  audience text not null default 'client',
  subject text not null default '',
  preheader text not null default '',
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  blocks jsonb not null default '[]',
  is_starter boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz
);

create index if not exists idx_comm_designs_updated on comm_email_designs(updated_at desc) where archived_at is null;

create table if not exists comm_email_sends (
  id uuid primary key default gen_random_uuid(),
  design_id uuid references comm_email_designs(id) on delete set null,
  design_name text not null default '',
  subject text not null,
  design_snapshot jsonb not null default '{}',
  is_test boolean not null default false,
  recipient_count integer not null default 0,
  sent_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_comm_sends_created on comm_email_sends(created_at desc);

create table if not exists comm_email_recipients (
  id uuid primary key default gen_random_uuid(),
  send_id uuid not null references comm_email_sends(id) on delete cascade,
  client_id uuid references clients(id) on delete set null,
  event_id uuid references events(id) on delete set null,
  email text not null,
  name text,
  status text not null default 'queued'
    check (status in ('queued', 'sent', 'delivered', 'delayed', 'bounced', 'complained', 'failed', 'suppressed')),
  resend_message_id text,
  error text,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_comm_recipients_send on comm_email_recipients(send_id);
create index if not exists idx_comm_recipients_resend on comm_email_recipients(resend_message_id);
create index if not exists idx_comm_recipients_client on comm_email_recipients(client_id, created_at desc);

create table if not exists comm_email_suppressions (
  email text primary key,
  reason text not null default 'manual' check (reason in ('bounce', 'complaint', 'unsubscribe', 'manual')),
  detail text,
  created_at timestamptz not null default now()
);

alter table comm_email_designs enable row level security;
alter table comm_email_sends enable row level security;
alter table comm_email_recipients enable row level security;
alter table comm_email_suppressions enable row level security;
