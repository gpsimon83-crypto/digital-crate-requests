-- Optional hero banners for the client portal home and admin dashboard —
-- purely presentational, admin-editable via Platform Settings, blank by
-- default so nothing shows until an admin sets an image/heading.

alter table platform_settings add column if not exists portal_hero_image_url text;
alter table platform_settings add column if not exists portal_hero_heading text;
alter table platform_settings add column if not exists portal_hero_subheading text;
alter table platform_settings add column if not exists admin_hero_image_url text;
alter table platform_settings add column if not exists admin_hero_heading text;
alter table platform_settings add column if not exists admin_hero_subheading text;

-- Per-template AI copy tone, remembered so re-generating stays consistent
-- with what an admin picked last time for that package.
alter table package_templates add column if not exists copy_tone text;
