-- Library: reusable business content, organized into four categories.
-- Email templates are stored as text (title/subject/body) so they can be
-- picked straight into the project email compose box later. Contracts,
-- Brochures, and Questionnaires are uploaded files (PDF/doc) stored in the
-- "library-files" bucket below.
create table if not exists library_items (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('email_template', 'contract', 'brochure', 'questionnaire')),
  title text not null,
  description text,
  subject text,
  body text,
  file_url text,
  file_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_library_items_category on library_items(category, created_at);

alter table library_items enable row level security;
-- No policies — same pattern as every other table here: all real access
-- goes through Next.js API routes using the service-role admin client.

insert into storage.buckets (id, name, public)
values ('library-files', 'library-files', true)
on conflict (id) do nothing;
