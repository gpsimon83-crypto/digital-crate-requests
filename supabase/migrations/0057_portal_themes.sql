-- Client portal looks: which palette each event category uses by default
-- (e.g. {"wedding": "pine-copper"}). An event can still pick its own look in
-- Customize Portal. Additive only.
alter table platform_settings add column if not exists portal_theme_by_category jsonb not null default '{}'::jsonb;
