-- Animate on flyer templates: motion saved with a template's working draft
-- (one set per size: story / portrait / square), copied into each published
-- version, and used as the starting motion for new flyers made from it.
-- Each flyer then keeps its own copy (flyer_designs.animation), so changing
-- a template never changes flyers already made. Additive only; safe to run again.

alter table flyer_templates add column if not exists animation jsonb;
alter table flyer_template_versions add column if not exists animation jsonb;

comment on column flyer_templates.animation is 'Animate: motion for the draft, by size ({"story": {...}, "portrait": {...}}). Copied into the version on publish.';
comment on column flyer_template_versions.animation is 'Animate: the motion published with this version; new flyers start with it.';
