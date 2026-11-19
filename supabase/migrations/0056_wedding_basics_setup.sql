-- Wedding Basics, part 3: questions that shape the package (what to cover,
-- where the ceremony is, indoors/outdoors, setup access, end time), client
-- fields the answers fill in, and shorter links with the couple's name.
-- Run after 0054 and 0055. Safe to run more than once; never changes
-- answers already given.

-- 1. Client details from Wedding Basics.
alter table clients add column if not exists partner_first_name text;
alter table clients add column if not exists partner_last_name text;
alter table clients add column if not exists partner_phone text;
alter table clients add column if not exists married_last_name text;
alter table clients add column if not exists contact_methods text[];
alter table clients add column if not exists best_days text[];
alter table clients add column if not exists best_times text[];

-- 2. Links like /w/caroline-catlin-7k2pxq9mab (name + 10 random characters).
alter table questionnaire_links drop constraint if exists questionnaire_links_token_check;
alter table questionnaire_links add constraint questionnaire_links_token_check check (char_length(token) between 12 and 120);

-- 3. The questions.
do $$
declare
  t uuid;
  s_day uuid;
  s_setup uuid;
begin
  select id into t from questionnaire_templates where event_type = 'wedding_basics';
  if t is null then
    raise exception 'Run 0054_questionnaire_links.sql first';
  end if;
  select id into s_day from questionnaire_sections where template_id = t and key = 'the_day';

  -- Reception end time, right after the start time.
  if s_day is not null and not exists (select 1 from questionnaire_questions where section_id = s_day and key = 'reception_end') then
    update questionnaire_questions set position = 5 where section_id = s_day and key = 'guest_count';
    insert into questionnaire_questions (section_id, key, position, prompt, subtext, question_type, allow_unsure, required)
    values (s_day, 'reception_end', 4, 'What time does your reception end?', 'Your best guess is fine for now.', 'time', false, true);
  end if;

  -- New section between "The Day" and "The Couple".
  select id into s_setup from questionnaire_sections where template_id = t and key = 'your_setup';
  if s_setup is null then
    update questionnaire_sections set position = position + 1 where template_id = t and position >= 2;
    insert into questionnaire_sections (template_id, key, title, position, transition_heading, transition_subheading)
    values (t, 'your_setup', 'Your Setup', 2, 'Next, how your day is set up', 'So we bring the right sound and plan setup.')
    returning id into s_setup;
  end if;

  insert into questionnaire_questions (section_id, key, position, prompt, subtext, question_type, options, allow_unsure, required, depends_on_question_key, depends_on_values)
  select s_setup, v.key, v.position, v.prompt, v.subtext, v.question_type, v.options::jsonb, false, true, v.dep_key, v.dep_values
  from (values
    ('coverage', 1, 'Which parts of your day would you like us to cover?', 'Pick all that apply.', 'multi_select',
     '[{"value":"ceremony","label":"Ceremony"},{"value":"cocktail","label":"Cocktail hour"},{"value":"reception","label":"Reception (dinner & dancing)"}]', null::text, null::jsonb),
    ('ceremony_location', 2, 'Where is your ceremony?', null, 'single_select',
     '[{"value":"same_room","label":"Same room as the reception"},{"value":"same_venue","label":"Same venue, different room or area"},{"value":"different","label":"A different location"},{"value":"unsure","label":"Not sure yet"}]', 'coverage', '["ceremony"]'::jsonb),
    ('indoor_outdoor', 3, 'Will any of it be outdoors?', null, 'single_select',
     '[{"value":"indoors","label":"All indoors"},{"value":"outdoors","label":"Outdoors"},{"value":"both","label":"Some indoors, some outdoors"},{"value":"unsure","label":"Not sure yet"}]', null, null),
    ('setup_access', 4, 'What''s the spot where the DJ sets up like?', 'This helps us plan load-in and setup time.', 'single_select',
     '[{"value":"easy","label":"Ground floor, easy load-in"},{"value":"stairs","label":"Stairs or no elevator"},{"value":"long_walk","label":"Long walk from parking"},{"value":"unsure","label":"Not sure yet"}]', null, null)
  ) as v(key, position, prompt, subtext, question_type, options, dep_key, dep_values)
  where not exists (
    select 1 from questionnaire_questions q
    join questionnaire_sections s on s.id = q.section_id
    where s.template_id = t and q.key = v.key
  );
end $$;
