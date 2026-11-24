-- Animate: video export jobs, and a private bucket for the finished MP4s.
--
-- The video is drawn and encoded in the browser of the person exporting it
-- (the site's servers can't run long video jobs). These rows track each job
-- (queued → rendering → encoding → completed, or failed / cancelled) so its
-- progress shows on any device, a cancel from anywhere stops the encoder,
-- a closed tab can't leave a job stuck, and the finished file is kept for
-- download. Additive only; safe to run again.

create table if not exists flyer_render_jobs (
  id uuid primary key default gen_random_uuid(),
  design_id uuid not null references flyer_designs(id) on delete cascade,
  -- The flyer's DJ (who may see and download it) and the person who started it.
  dj_id uuid references djs(id) on delete set null,
  created_by uuid not null,
  format text not null check (format in ('story', 'portrait', 'square')),
  width int not null check (width between 200 and 2160),
  height int not null check (height between 200 and 3840),
  duration numeric not null check (duration in (6, 8, 10, 15)),
  fps int not null default 30 check (fps = 30),
  status text not null default 'queued' check (status in ('queued', 'rendering', 'encoding', 'completed', 'failed', 'cancelled')),
  progress numeric not null default 0 check (progress between 0 and 1),
  error text,
  attempts int not null default 1 check (attempts between 1 and 3),
  codec text,
  storage_path text,
  bytes bigint,
  -- Last sign of life from the browser doing the work; stale active jobs are marked failed.
  heartbeat_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  finished_at timestamptz
);

create index if not exists flyer_render_jobs_design on flyer_render_jobs (design_id, created_at desc);
create index if not exists flyer_render_jobs_active on flyer_render_jobs (created_by) where status in ('queued', 'rendering', 'encoding');

-- Only the server (service role) reads and writes jobs; the API checks who may see each one.
alter table flyer_render_jobs enable row level security;

insert into storage.buckets (id, name, public)
values ('flyer-videos', 'flyer-videos', false)
on conflict (id) do update set public = false;

comment on table flyer_render_jobs is 'Animate video exports: status and progress of each browser-rendered MP4, and where the finished file is stored (bucket flyer-videos).';
