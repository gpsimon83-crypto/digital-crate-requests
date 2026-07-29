-- Structured ceremony/reception song planner for wedding events, modeled
-- directly on the DJ's existing paper/Google-Forms wedding questionnaire
-- ("Your Wedding Music List"). One JSONB column rather than a dozen new
-- events columns, since this only applies to event_type='wedding' and the
-- shape is a fixed, known set of fields (not something queried on).
alter table events add column if not exists wedding_music_plan jsonb not null default '{}'::jsonb;
