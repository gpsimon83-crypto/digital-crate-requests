-- Equipment recommendations from the questionnaire.
--
-- 1. equipment_setup_rules: configurable rules that turn an event's details
--    (guest count, event type, spaces, indoor/outdoor, microphone needs)
--    into gear from the inventory, per space: Reception audio, Ceremony
--    audio, Cocktail-hour audio, Microphones. Each rule points at one
--    inventory item or, more flexibly, a category ("speakers"), with a
--    quantity and the reason shown to staff.
-- 2. event_equipment_plans: what staff approved for an event, and the
--    inputs it was based on, so a later change (guests, venue, timing,
--    setup answers) flags the plan for review without touching assignments.
-- 3. event_equipment_assignments.plan_item_key: assignments created by
--    confirming a plan carry the plan line's key, unique per event, so
--    confirming twice updates instead of duplicating. Manual assignments
--    leave it null and are never touched by a plan.
-- 4. Planning questionnaire: a short "Sound & setup" section on every
--    planning questionnaire (wedding ones also ask about the ceremony,
--    cocktail hour and ceremony time).
-- Additive only.

create table if not exists equipment_setup_rules (
  id uuid primary key default gen_random_uuid(),
  space text not null check (space in ('reception', 'ceremony', 'cocktail', 'microphones')),
  label text not null check (char_length(label) <= 120),
  -- Same shape as gig_equipment_rules.conditions: [{source, field, op, value}], all must match.
  conditions jsonb not null default '[]'::jsonb,
  equipment_id uuid references equipment(id) on delete set null,
  equipment_category text,
  quantity integer not null default 1 check (quantity between 1 and 50),
  reason text check (reason is null or char_length(reason) <= 300),
  position int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_setup_rules_target check (equipment_id is not null or equipment_category is not null)
);
create index if not exists idx_equipment_setup_rules_active on equipment_setup_rules (is_active, space, position);
alter table equipment_setup_rules enable row level security;

create table if not exists event_equipment_plans (
  event_id uuid primary key references events(id) on delete cascade,
  items jsonb not null default '[]'::jsonb,
  inputs jsonb not null default '{}'::jsonb,
  fingerprint text,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table event_equipment_plans enable row level security;

alter table event_equipment_assignments add column if not exists plan_item_key text;
create unique index if not exists uq_event_equipment_plan_item on event_equipment_assignments (event_id, plan_item_key) where plan_item_key is not null;

-- Starter rules (edit them in Admin → Equipment → Setup rules). Category
-- based so they work with whatever speakers / mics are in the inventory.
do $$
begin
  if exists (select 1 from equipment_setup_rules) then
    return;
  end if;
  insert into equipment_setup_rules (space, label, conditions, equipment_category, quantity, reason, position) values
    ('reception', 'Main speakers, up to 100 guests', '[{"source":"event","field":"guest_count","op":"lte","value":100}]', 'speakers', 2, 'Two speakers cover a room of up to 100 guests', 10),
    ('reception', 'Main speakers, 101–200 guests', '[{"source":"event","field":"guest_count","op":"gte","value":101},{"source":"event","field":"guest_count","op":"lte","value":200}]', 'speakers', 3, '101–200 guests need a third speaker for even coverage', 11),
    ('reception', 'Main speakers, 201–300 guests', '[{"source":"event","field":"guest_count","op":"gte","value":201},{"source":"event","field":"guest_count","op":"lte","value":300}]', 'speakers', 4, '201–300 guests need four speakers', 12),
    ('reception', 'Main speakers, over 300 guests', '[{"source":"event","field":"guest_count","op":"gt","value":300}]', 'speakers', 5, 'Over 300 guests: five speakers; confirm the room with the venue', 13),
    ('reception', 'Extra speaker for outdoors', '[{"source":"answer","field":"setting","op":"in","value":"outdoors,both"}]', 'speakers', 1, 'Sound carries less outdoors', 14),
    ('reception', 'Mixer', '[]', 'mixer', 1, 'Runs the reception system', 15),
    ('ceremony', 'Ceremony speaker', '[{"source":"event","field":"guest_count","op":"lte","value":150}]', 'speakers', 1, 'A separate ceremony space needs its own speaker', 20),
    ('ceremony', 'Ceremony speakers, over 150 guests', '[{"source":"event","field":"guest_count","op":"gt","value":150}]', 'speakers', 2, 'Over 150 guests at the ceremony: two speakers', 21),
    ('ceremony', 'Ceremony mixer', '[{"source":"answer","field":"ceremony_space","op":"eq","value":"different"}]', 'mixer', 1, 'A ceremony at a different location needs its own mixer', 22),
    ('cocktail', 'Cocktail-hour speaker', '[]', 'speakers', 1, 'Cocktail hour in a separate space', 30),
    ('microphones', 'Mic for the officiant and vows', '[{"source":"answer","field":"microphones","op":"includes","value":"officiant"}]', 'microphone', 1, 'Officiant and vows at the ceremony', 40),
    ('microphones', 'Mic for toasts', '[{"source":"answer","field":"microphones","op":"includes","value":"toasts"}]', 'microphone', 1, 'Toasts and speeches', 41),
    ('microphones', 'Mic for announcements', '[{"source":"answer","field":"microphones","op":"includes","value":"announcements"},{"source":"answer","field":"microphones","op":"excludes","value":"toasts"}]', 'microphone', 1, 'Announcements (shared with toasts when both are needed)', 42),
    ('microphones', 'Mic for live performance', '[{"source":"answer","field":"microphones","op":"includes","value":"live"}]', 'microphone', 1, 'Live singing or a performer', 43);
end $$;

-- Sound & setup questions on every planning questionnaire.
do $$
declare
  t record;
  s uuid;
  wedding boolean;
begin
  for t in select id, event_type from questionnaire_templates where event_type <> 'wedding_basics' loop
    wedding := t.event_type = 'wedding';
    select id into s from questionnaire_sections where template_id = t.id and key = 'sound_setup';
    if s is null then
      insert into questionnaire_sections (template_id, key, title, position, transition_heading, transition_subheading)
      values (t.id, 'sound_setup', 'Sound & Setup', (select coalesce(max(position), 0) + 1 from questionnaire_sections where template_id = t.id),
              'A few setup questions', 'So we bring the right sound for your spaces.')
      returning id into s;
    end if;

    insert into questionnaire_questions (section_id, key, position, prompt, subtext, question_type, options, allow_unsure, required, depends_on_question_key, depends_on_values)
    select s, v.key, v.position, v.prompt, v.subtext, v.question_type, v.options::jsonb, true, false, v.dep_key, v.dep_values
    from (values
      ('setup_setting', 1, 'Will your event be indoors or outdoors?', null, 'single_select',
       '[{"value":"indoors","label":"Indoors"},{"value":"outdoors","label":"Outdoors"},{"value":"both","label":"Some of each"}]', null::text, null::jsonb, true),
      ('setup_ceremony_space', 2, 'Where is the ceremony?', null, 'single_select',
       '[{"value":"same_room","label":"Same room as the reception"},{"value":"same_venue","label":"Same venue, different room or area"},{"value":"different","label":"A different location"},{"value":"none","label":"No ceremony with us"}]', null, null, wedding),
      ('setup_ceremony_time', 3, 'What time does the ceremony start?', 'Your best guess is fine.', 'time', '[]', 'setup_ceremony_space', '["same_room","same_venue","different"]'::jsonb, wedding),
      ('setup_cocktail_space', 4, 'Where is cocktail hour?', null, 'single_select',
       '[{"value":"same_room","label":"Same room as the reception"},{"value":"separate","label":"A separate space"},{"value":"none","label":"No cocktail hour"}]', null, null, wedding),
      ('setup_microphones', 5, 'Who will need a microphone?', 'Pick all that apply.', 'multi_select',
       '[{"value":"officiant","label":"Officiant / vows"},{"value":"toasts","label":"Toasts & speeches"},{"value":"announcements","label":"Announcements"},{"value":"live","label":"Live singing or a performer"},{"value":"none","label":"No microphones"}]', null, null, true)
    ) as v(key, position, prompt, subtext, question_type, options, dep_key, dep_values, include)
    where v.include
      and not exists (select 1 from questionnaire_questions q join questionnaire_sections x on x.id = q.section_id where x.template_id = t.id and q.key = v.key);
    s := null;
  end loop;
end $$;
