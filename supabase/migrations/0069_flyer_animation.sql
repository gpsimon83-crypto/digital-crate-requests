-- Animate mode for flyers: versioned animation settings stored on the
-- flyer itself, next to (never inside) the static layout. Null = a
-- static flyer, exactly as before. Additive only; safe to run again.

alter table flyer_designs add column if not exists animation jsonb;
alter table flyer_designs add column if not exists animation_updated_at timestamptz;

comment on column flyer_designs.animation is
  'Animate mode settings (v1): duration, fps, intensity, readable lock, recipe, and per-layer motion stacks keyed by layer id. The scene stays the resting layout.';
