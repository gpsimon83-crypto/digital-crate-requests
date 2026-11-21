-- Admin dashboard layouts (Modern Studio / Midnight Command): a second
-- banner photo for club & bar nights, and where each banner photo is
-- cropped (focal points). The wedding photo stays admin_hero_image_url.
alter table platform_settings add column if not exists admin_club_image_url text;
-- { "wedding": { "xPosition": 0-100, "yPosition": 0-100 }, "club": { ... } }
alter table platform_settings add column if not exists admin_dashboard_banners jsonb;
