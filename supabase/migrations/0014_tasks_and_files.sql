-- Per-project task checklist ("what step are we on, what has to happen
-- next, and by when") — either staff or the assigned DJ can add these,
-- enforced at the API layer the same way email threads already are
-- (requireEventAccess), not via RLS.
create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  title text not null,
  due_date date,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_tasks_event on tasks(event_id, completed_at, due_date);

-- Per-project file store: manual uploads (contracts, misc documents) and
-- attachments captured from the email thread in either direction. Separate
-- from library_items, which holds reusable, event-independent templates.
create table if not exists event_files (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  category text not null check (category in ('contract', 'email_attachment', 'other')),
  file_url text not null,
  file_name text not null,
  source text not null default 'upload' check (source in ('upload', 'email')),
  email_message_id uuid references email_messages(id) on delete set null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_event_files_event on event_files(event_id, created_at desc);

alter table tasks enable row level security;
alter table event_files enable row level security;
-- No policies — service-role-only access via API routes, same pattern as
-- every other table in this app.

insert into storage.buckets (id, name, public)
values ('event-files', 'event-files', true)
on conflict (id) do nothing;
