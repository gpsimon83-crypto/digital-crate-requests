-- No post-wedding review request ever reached a couple — the automation
-- engine (trigger/condition/action, days_after_event already supported)
-- already had everything needed except a place to store the business's
-- own review link and a seeded example automation using it.
alter table platform_settings add column if not exists review_url text;

-- A ready-to-use email template, referenced by the seeded automation
-- below. Uses the library's existing free-form category so it shows up
-- next to other reusable email bodies in Library, not a new concept.
insert into library_items (title, category, subject, body)
select
  'Post-Event Review Request',
  'email_template',
  'How was your event with Digital Crate DJs?',
  E'Hi {{client_first_name}},\n\nThank you again for having us DJ {{event_type}}! We hope it was everything you hoped for.\n\nIf you have a minute, a review would mean the world to us and helps other couples find us:\n\n{{review_link}}\n\nThanks again,\n{{dj_name}} and the Digital Crate DJs team'
where not exists (select 1 from library_items where title = 'Post-Event Review Request' and category = 'email_template');

-- Seeded disabled — the business should confirm the copy and set
-- platform_settings.review_url before this goes live to real clients.
insert into automations (name, trigger, conditions, actions, is_active)
select
  'Post-Event Review Request',
  'days_after_event:3',
  '[{"field":"status","operator":"equals","value":"ended"}]'::jsonb,
  jsonb_build_array(jsonb_build_object('type', 'send_email', 'templateId', li.id)),
  false
from library_items li
where li.title = 'Post-Event Review Request' and li.category = 'email_template'
  and not exists (select 1 from automations where name = 'Post-Event Review Request');
