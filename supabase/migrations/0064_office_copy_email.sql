-- Office copy of DJ client email: when a DJ emails a DCDJ client (anyone who
-- didn't come in as that DJ's own lead), a hidden BCC copy goes here.
-- Empty = no copies. Settings → Email copies.
alter table platform_settings add column if not exists office_copy_email text;
