-- Wedding Basics: how the couple likes to be contacted and when they're free
-- for a call or meeting. Run after 0054. Safe to run more than once: it only
-- adds what's missing and never changes answers already given.

do $$
declare
  t uuid;
  s3 uuid;
begin
  select id into t from questionnaire_templates where event_type = 'wedding_basics';
  if t is null then
    raise exception 'Run 0054_questionnaire_links.sql first';
  end if;

  -- The intro said "Ten quick questions"; there are now thirteen.
  update questionnaire_templates
     set opening_body = 'A few quick questions so we can check availability, hold your date and know the best way to reach you. It takes about two minutes, and everything saves as you go.'
   where id = t
     and opening_body like 'Ten quick questions%';

  select id into s3 from questionnaire_sections where template_id = t and key = 'staying_in_touch';
  if s3 is null then
    insert into questionnaire_sections (template_id, key, title, position, transition_heading, transition_subheading)
    values (t, 'staying_in_touch', 'Staying in Touch', 3, 'Last thing: staying in touch', 'So we reach you the way you like, when it suits you.')
    returning id into s3;
  end if;

  insert into questionnaire_questions (section_id, key, position, prompt, subtext, question_type, options, allow_unsure, required)
  select s3, v.key, v.position, v.prompt, v.subtext, v.question_type, v.options::jsonb, false, true
  from (values
    ('contact_methods', 1, 'What''s the best way to reach you?', 'Pick all that work for you.', 'multi_select',
     '[{"value":"text","label":"Text"},{"value":"call","label":"Phone call"},{"value":"email","label":"Email"},{"value":"video","label":"Video call (FaceTime / Zoom)"},{"value":"in_person","label":"Meet in person"}]'),
    ('best_days', 2, 'Which days are best for a call or meeting?', 'Pick all that work.', 'multi_select',
     '[{"value":"mon","label":"Monday"},{"value":"tue","label":"Tuesday"},{"value":"wed","label":"Wednesday"},{"value":"thu","label":"Thursday"},{"value":"fri","label":"Friday"},{"value":"sat","label":"Saturday"},{"value":"sun","label":"Sunday"}]'),
    ('best_times', 3, 'What time of day works best?', 'Pick all that work.', 'multi_select',
     '[{"value":"morning","label":"Morning (9 AM – 12 PM)"},{"value":"afternoon","label":"Afternoon (12 – 5 PM)"},{"value":"evening","label":"Evening (5 – 8 PM)"}]')
  ) as v(key, position, prompt, subtext, question_type, options)
  where not exists (
    select 1 from questionnaire_questions q
    join questionnaire_sections s on s.id = q.section_id
    where s.template_id = t and q.key = v.key
  );
end $$;
