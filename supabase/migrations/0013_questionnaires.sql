-- Interactive, slide-based event questionnaires. Fully data-driven (no
-- hardcoded question lists in application code) so an admin builder can
-- manage content later without touching the engine or rebuilding anything.
-- One template per event_type; each template has ordered sections
-- ("chapters"); each section has ordered questions; each question can
-- optionally depend on a prior answer (simple show/hide, not pricing
-- logic). A client's answers for one event live in a single
-- questionnaire_responses row as a flat {question_key: value} JSON object,
-- which keeps this easy to extend later (e.g. a Smart Calculator reading
-- the same answers) without a schema change.

create table if not exists questionnaire_templates (
  id uuid primary key default gen_random_uuid(),
  event_type text not null unique,
  title text not null,
  opening_heading text not null,
  opening_body text not null,
  opening_cta_label text not null default 'Start Planning →',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists questionnaire_sections (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references questionnaire_templates(id) on delete cascade,
  key text not null,
  title text not null,
  position int not null,
  transition_heading text,
  transition_subheading text,
  created_at timestamptz not null default now(),
  unique (template_id, key)
);

create index if not exists idx_questionnaire_sections_template on questionnaire_sections(template_id, position);

create table if not exists questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references questionnaire_sections(id) on delete cascade,
  key text not null,
  position int not null,
  prompt text not null,
  subtext text,
  question_type text not null check (question_type in (
    'single_select', 'multi_select', 'short_text', 'long_text', 'person_list', 'song', 'time'
  )),
  options jsonb not null default '[]'::jsonb,
  allow_unsure boolean not null default true,
  required boolean not null default false,
  depends_on_question_key text,
  depends_on_values jsonb,
  created_at timestamptz not null default now(),
  unique (section_id, key)
);

create index if not exists idx_questionnaire_questions_section on questionnaire_questions(section_id, position);

create table if not exists questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  template_id uuid not null references questionnaire_templates(id),
  answers jsonb not null default '{}'::jsonb,
  current_question_key text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (event_id)
);

alter table questionnaire_templates enable row level security;
alter table questionnaire_sections enable row level security;
alter table questionnaire_questions enable row level security;
alter table questionnaire_responses enable row level security;
-- No policies — same pattern as every other table here: all real access
-- goes through Next.js API routes using the service-role admin client.
