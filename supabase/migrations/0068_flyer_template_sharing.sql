-- Who sees each flyer template in their portal.
--
--   all       every DJ (what happens today, so existing templates keep working)
--   selected  only the DJs listed in flyer_template_shares
--   office    staff only (e.g. while trying it out, or office-made flyers)
--
-- Staff always see every published template. A template the office has
-- turned on for a venue or event (Activate) still starts that venue's or
-- event's flyers. Additive only; safe to run again.

alter table flyer_templates add column if not exists share_mode text not null default 'all';
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'flyer_templates_share_mode_check') then
    alter table flyer_templates add constraint flyer_templates_share_mode_check check (share_mode in ('all', 'selected', 'office'));
  end if;
end $$;

create table if not exists flyer_template_shares (
  template_id uuid not null references flyer_templates(id) on delete cascade,
  dj_id uuid not null references djs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (template_id, dj_id)
);
create index if not exists idx_flyer_template_shares_dj on flyer_template_shares(dj_id);
alter table flyer_template_shares enable row level security;
-- No policies: server-only, like the other flyer tables.
