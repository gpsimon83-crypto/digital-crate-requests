-- Questionnaires sent by a private link (no login), for clients we can't
-- email yet — e.g. a wedding lead whose email bounces. Staff copy or text
-- the link from the event page; answers are saved to the event.
-- Additive only: existing questionnaires, responses and events are untouched.

-- 1. New answer types: date, number, phone, email (the builder can use them too).
alter table questionnaire_questions drop constraint if exists questionnaire_questions_question_type_check;
alter table questionnaire_questions add constraint questionnaire_questions_question_type_check check (question_type in (
  'single_select', 'multi_select', 'short_text', 'long_text', 'person_list', 'song', 'time',
  'date', 'number', 'phone', 'email'
));

-- 2. One link per event per questionnaire. The token is the link's secret
--    (unguessable, 32 random bytes); revoking or making a new link ends it.
create table if not exists questionnaire_links (
  id uuid primary key default gen_random_uuid(),
  token text not null unique check (char_length(token) between 32 and 80),
  event_id uuid not null references events(id) on delete cascade,
  template_id uuid not null references questionnaire_templates(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  current_question_key text,
  completed_at timestamptz,
  -- After submitting, answers are locked; staff can unlock to let them edit.
  locked boolean not null default false,
  -- Which event / client fields were filled from the answers (only empty ones are filled).
  applied jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  opened_at timestamptz,
  revoked_at timestamptz
);
create index if not exists idx_questionnaire_links_event on questionnaire_links (event_id, created_at desc);
alter table questionnaire_links enable row level security;

-- 3. "Wedding basics": the 10 things we need first, all required.
do $$
declare
  t uuid;
  s1 uuid;
  s2 uuid;
begin
  if exists (select 1 from questionnaire_templates where event_type = 'wedding_basics') then
    return;
  end if;
  insert into questionnaire_templates (event_type, title, opening_heading, opening_body, opening_cta_label)
  values (
    'wedding_basics',
    'Wedding Basics',
    'Let''s lock in your date',
    'Ten quick questions so we can check availability and hold your date. It takes about two minutes, and everything saves as you go.',
    'Get Started →'
  )
  returning id into t;

  insert into questionnaire_sections (template_id, key, title, position, transition_heading, transition_subheading)
  values (t, 'the_day', 'The Day', 1, 'First, the big day', 'When and where it''s happening.')
  returning id into s1;
  insert into questionnaire_sections (template_id, key, title, position, transition_heading, transition_subheading)
  values (t, 'the_couple', 'The Couple', 2, 'Now, about you two', 'So we know who we''re celebrating and how to reach you.')
  returning id into s2;

  insert into questionnaire_questions (section_id, key, position, prompt, subtext, question_type, allow_unsure, required) values
    (s1, 'wedding_date', 1, 'What''s your wedding date?', null, 'date', false, true),
    (s1, 'venue', 2, 'Where is your reception?', 'Venue name and city — e.g. The Grand Hall, Milwaukee.', 'short_text', false, true),
    (s1, 'reception_start', 3, 'What time does your reception start?', 'Your best guess is fine for now.', 'time', false, true),
    (s1, 'guest_count', 4, 'About how many guests are you expecting?', 'An estimate is perfect.', 'number', false, true),
    (s2, 'partner_one_name', 1, 'What''s your full name?', null, 'short_text', false, true),
    (s2, 'partner_two_name', 2, 'What''s your partner''s full name?', null, 'short_text', false, true),
    (s2, 'married_name', 3, 'What last name will you go by after the wedding?', 'This is how we''ll introduce you — e.g. "Mr. & Mrs. Catlin".', 'short_text', false, true),
    (s2, 'partner_one_phone', 4, 'What''s your phone number?', null, 'phone', false, true),
    (s2, 'partner_two_phone', 5, 'What''s your partner''s phone number?', null, 'phone', false, true),
    (s2, 'email', 6, 'What''s the best email for you?', 'For your contract and planning portal — please double-check the spelling.', 'email', false, true);
end $$;
