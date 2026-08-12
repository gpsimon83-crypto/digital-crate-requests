-- Per-DJ mailbox connection for sending/receiving client email through
-- their own real inbox (iPage/Network Solutions mail, not a dedicated
-- transactional-email service). The password is encrypted application-side
-- (AES-256-GCM) before it ever reaches this column — this table never
-- holds a plaintext credential.
create table if not exists email_accounts (
  id uuid primary key default gen_random_uuid(),
  dj_id uuid not null references djs(id) on delete cascade,
  email_address text not null,
  smtp_host text not null,
  smtp_port int not null default 587,
  imap_host text not null,
  imap_port int not null default 993,
  encrypted_password text not null,
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (dj_id)
);

alter table email_accounts enable row level security;
-- No policies — same pattern as every other table here: all real access
-- goes through Next.js API routes using the service-role admin client.
