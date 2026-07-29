-- Mirrors contract_sent_at: the wedding music questionnaire is a template
-- the DJ sends to a client (not something that auto-appears), so a client
-- only sees it in their portal once this is set.
alter table events add column if not exists wedding_music_plan_sent_at timestamptz;
