-- Luxury client portal: per-event hero customization (couple display
-- name, its own hero photo + crop settings, headline/subheading
-- overrides, timezone for an accurate countdown) plus a matching
-- crop-settings column for the platform-wide default portal hero image.
--
-- This is a SEPARATE image from events.hero_image_url on purpose —
-- hero_image_url already powers the public guest-request-page hero
-- (/r/[eventCode], a different audience/moment: party guests during the
-- live event) and is edited by the DJ via /api/events/[id]/settings.
-- The client portal is a different surface for a different audience
-- (the booking client, while planning) and may reasonably want a
-- different photo — so it gets its own field, own upload route, and its
-- own admin-only "Customize Portal" panel, without touching the
-- existing DJ-facing guest-hero feature at all.
--
-- All nullable/additive — nothing existing changes behavior until an
-- admin sets these.

alter table events add column if not exists couple_display_name text;
alter table events add column if not exists portal_hero_image_url text;
alter table events add column if not exists portal_hero_settings jsonb;
alter table events add column if not exists portal_hero_headline_override text;
alter table events add column if not exists portal_hero_subheading_override text;
alter table events add column if not exists timezone text default 'America/Chicago';

alter table platform_settings add column if not exists portal_hero_settings jsonb;
