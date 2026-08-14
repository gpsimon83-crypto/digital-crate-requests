-- Real contract templates + lifecycle, replacing the old "paste a URL into
-- an events column" model. Contracts are now their own table: one row per
-- contract instance (draft/sent/signed/void), full history per event,
-- either rendered from a reusable template or an uploaded file.

alter table library_items drop constraint if exists library_items_category_check;
alter table library_items add constraint library_items_category_check
  check (category in ('email_template', 'contract', 'brochure', 'questionnaire', 'contract_template'));

create table if not exists contracts (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  template_id uuid references library_items(id) on delete set null,
  status text not null default 'draft',
  title text not null,
  body text,
  file_url text,
  file_name text,
  sent_at timestamptz,
  signed_at timestamptz,
  signed_by_name text,
  signed_ip text,
  signed_user_agent text,
  voided_at timestamptz,
  void_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint contracts_status_check check (status in ('draft', 'sent', 'signed', 'void')),
  constraint contracts_content_check check (body is not null or file_url is not null)
);
create index if not exists idx_contracts_event on contracts(event_id, created_at desc);

alter table contracts enable row level security;

alter table events add column if not exists contract_status text not null default 'none';
alter table events add constraint events_contract_status_check
  check (contract_status in ('none', 'draft', 'sent', 'signed', 'void'));

-- Backfill: one contracts row per event that already had a contract under
-- the old model, so lifecycle history isn't lost.
insert into contracts (event_id, status, title, file_url, sent_at, signed_at, signed_by_name, created_at)
select id,
       case when contract_signed_at is not null then 'signed' else 'sent' end,
       'Contract',
       contract_document_url,
       contract_sent_at,
       contract_signed_at,
       contract_signed_by,
       coalesce(contract_sent_at, now())
from events
where contract_document_url is not null;

update events set contract_status = case when contract_signed_at is not null then 'signed' else 'sent' end
where contract_document_url is not null;

alter table events drop column if exists contract_sent_at;
alter table events drop column if exists contract_signed_at;
alter table events drop column if exists contract_signed_by;
alter table events drop column if exists contract_document_url;
