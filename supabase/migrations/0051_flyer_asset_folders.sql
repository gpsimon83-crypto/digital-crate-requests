-- Flyer Creator: organise uploaded images into folders.
-- Folders are just a label on each image (no separate table): a folder
-- exists while something is in it. Staff organise template art; each DJ
-- organises their own uploads.
alter table flyer_assets add column if not exists folder text check (folder is null or char_length(folder) between 1 and 60);
alter table flyer_assets add column if not exists updated_at timestamptz not null default now();
create index if not exists idx_flyer_assets_folder on flyer_assets (scope, owner_dj_id, folder);
