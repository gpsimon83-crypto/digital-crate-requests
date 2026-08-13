-- Lets a file added to a project's Files tab record that it came straight
-- from the Library (a contract/brochure template), not just a fresh
-- upload or an email attachment — so the UI can label it accurately.
alter table event_files drop constraint if exists event_files_source_check;
alter table event_files add constraint event_files_source_check check (source in ('upload', 'email', 'library'));
