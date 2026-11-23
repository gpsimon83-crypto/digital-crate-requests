-- Bar packages and the Event Basics questionnaire.
--
-- 1. Bars & Nightlife packages (applied once, like 0066): "Bar Night –
--    House Sound" at $500 for 4 hours ($275 flat DJ payout) and "Bar
--    Residency" (quote; the payout is set per date on each offer). A package
--    already named the same is adopted instead of duplicated. Running this
--    again never overwrites edits made on the Services page.
-- 2. "Event Basics": a short questionnaire for parties, school, corporate
--    and bar events, so answers can recommend a package and price (Wedding
--    Basics already does this for weddings). Skipped if it already exists.
--
-- Run after 0066. Additive only.

do $$
declare
  rev constant text := 'bars-2026-11';
  spec jsonb;
  pid uuid;
  cid uuid;
  pos int := 0;
begin
  if to_regclass('public.catalog_revisions') is null then
    raise exception 'Run 0066_services_catalog_payouts.sql first';
  end if;
  if exists (select 1 from catalog_revisions where key = rev) then
    return;
  end if;
  insert into service_categories (slug, name, position) values ('bars-nightlife', 'Bars & Nightlife', 2) on conflict (slug) do nothing;
  select id into cid from service_categories where slug = 'bars-nightlife';

  for spec in select * from jsonb_array_elements($json$[
    {"key":"bar-night-house-sound","name":"Bar Night – House Sound","price":500,"hours":4,"type":"fixed","flat":27500,
     "description":"One night of open-format DJing on your venue's house sound system, reading the room from happy hour to last call.",
     "features":["DJ for 4 hours","Plays through your house sound system","Open-format music for your crowd","Requests and announcements"]},
    {"key":"bar-residency","name":"Bar Residency","price":0,"hours":null,"type":"quote","flat":null,
     "description":"A recurring night with the same DJ on a set schedule. The rate per night is set by your venue, the hours and the equipment needed.",
     "features":["Recurring nights on a set schedule","The same DJ each week","House sound or our gear","Rate per night confirmed before booking"]}
  ]$json$::jsonb) loop
    select id into pid from packages where seed_key = spec->>'key';
    if pid is null then
      select id into pid from packages where seed_key is null and lower(replace(name, '-', '–')) = lower(spec->>'name') order by created_at limit 1;
    end if;
    if pid is null then
      insert into packages (name, description, price, hours, features, position, is_active, seed_key, pricing_type, payout_type, payout_percent, payout_flat_cents)
      values (spec->>'name', spec->>'description', (spec->>'price')::numeric, (spec->>'hours')::numeric, spec->'features', 40 + pos, true,
              spec->>'key', spec->>'type', 'flat', 55, (spec->>'flat')::int)
      returning id into pid;
    else
      update packages set seed_key = spec->>'key', pricing_type = spec->>'type', payout_type = 'flat',
             payout_flat_cents = coalesce(payout_flat_cents, (spec->>'flat')::int), is_active = true, updated_at = now()
       where id = pid;
    end if;
    insert into package_category_links (package_id, category_id, position) values (pid, cid, pos) on conflict do nothing;
    pos := pos + 1;
  end loop;

  insert into catalog_revisions (key, notes) values (rev, 'Bars & Nightlife: Bar Night – House Sound ($500, 4 h, $275 flat payout) and Bar Residency (quote, payout per date).');
end $$;

do $$
declare
  t uuid;
  s1 uuid;
  s2 uuid;
begin
  if exists (select 1 from questionnaire_templates where event_type = 'event_basics') then
    return;
  end if;
  insert into questionnaire_templates (event_type, title, opening_heading, opening_body, opening_cta_label)
  values ('event_basics', 'Event Basics', 'Let''s plan your event',
          'A few quick questions so we can check the date and suggest the right package. About two minutes, and everything saves as you go.',
          'Get Started →')
  returning id into t;

  insert into questionnaire_sections (template_id, key, title, position, transition_heading, transition_subheading)
  values (t, 'the_event', 'The Event', 1, 'First, the basics', 'When, where and how many.')
  returning id into s1;
  insert into questionnaire_sections (template_id, key, title, position, transition_heading, transition_subheading)
  values (t, 'the_setup', 'The Setup', 2, 'Next, what you need', 'So we bring the right sound and lighting.')
  returning id into s2;

  insert into questionnaire_questions (section_id, key, position, prompt, subtext, question_type, options, allow_unsure, required) values
    (s1, 'event_date', 1, 'What''s the date?', null, 'date', '[]'::jsonb, false, true),
    (s1, 'venue', 2, 'Where is it?', 'Venue name and city.', 'short_text', '[]'::jsonb, false, true),
    (s1, 'start_time', 3, 'What time should the music start?', 'Your best guess is fine.', 'time', '[]'::jsonb, false, true),
    (s1, 'end_time', 4, 'What time does it end?', 'Your best guess is fine.', 'time', '[]'::jsonb, false, true),
    (s1, 'guest_count', 5, 'About how many guests?', 'An estimate is perfect.', 'number', '[]'::jsonb, false, true),
    (s2, 'needs', 1, 'What would you like at your event?', 'Pick all that apply.', 'multi_select',
     '[{"value":"mic","label":"Speeches, awards or announcements (wireless mic)"},{"value":"background","label":"Background music before dancing (arrival, dinner or cocktails)"},{"value":"uplighting","label":"Room uplighting"},{"value":"clean","label":"Clean music only"},{"value":"dancing","label":"Dancing"}]'::jsonb, false, false),
    (s2, 'indoor_outdoor', 2, 'Will any of it be outdoors?', null, 'single_select',
     '[{"value":"indoors","label":"All indoors"},{"value":"outdoors","label":"Outdoors"},{"value":"both","label":"Some indoors, some outdoors"},{"value":"unsure","label":"Not sure yet"}]'::jsonb, false, true),
    (s2, 'setup_access', 3, 'What''s the spot where the DJ sets up like?', 'This helps us plan load-in and setup time.', 'single_select',
     '[{"value":"easy","label":"Ground floor, easy load-in"},{"value":"stairs","label":"Stairs or no elevator"},{"value":"long_walk","label":"Long walk from parking"},{"value":"house_sound","label":"The venue has its own sound system"},{"value":"unsure","label":"Not sure yet"}]'::jsonb, false, true);
end $$;
