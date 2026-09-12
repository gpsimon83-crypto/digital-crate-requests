-- Seeds a starter service catalog — without this, the Equipment Rules
-- and Services tabs have nothing to pick from (the "Recommend" dropdown
-- being empty was silently disabling Save with no explanation).
-- Editable example prices, not live business policy — adjust freely.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'service_catalog_items_name_key') then
    alter table service_catalog_items add constraint service_catalog_items_name_key unique (name);
  end if;
end $$;

insert into service_catalog_items (name, description, category, pricing_method, unit_label, price_cents, is_client_visible, is_active, position) values
  ('DJ Performance', 'Core DJ performance for the event.', 'performance', 'per_event', null, 60000, true, true, 0),
  ('MC Services', 'Master of ceremonies / announcements throughout the event.', 'performance', 'per_event', null, 15000, true, true, 1),
  ('Additional Performance Time', 'Extra DJ time beyond what''s included in the package.', 'performance', 'hourly', 'hour', 10000, true, true, 2),
  ('Ceremony Sound', 'Sound system and mic coverage for a ceremony at a separate location or time.', 'sound', 'per_event', null, 15000, true, true, 3),
  ('Cocktail-Hour Sound', 'Sound coverage for a cocktail hour separate from the main reception setup.', 'sound', 'per_event', null, 15000, true, true, 4),
  ('Additional Speaker', 'Extra powered speaker for larger rooms or outdoor coverage.', 'sound', 'per_unit', 'speaker', 7500, true, true, 5),
  ('Wireless Microphone', 'Handheld or lavalier wireless mic for toasts, speeches, or MC use.', 'sound', 'per_unit', 'mic', 2500, true, true, 6),
  ('Lighting Package', 'Dance-floor lighting package.', 'lighting', 'per_event', null, 20000, true, true, 7),
  ('Uplighting', 'Uplighting fixtures around the venue, priced per fixture.', 'lighting', 'per_unit', 'fixture', 1500, true, true, 8),
  ('Special Effects', 'Fog, cold-spark, or similar special effects for key moments.', 'lighting', 'per_event', null, 15000, true, true, 9),
  ('Setup', 'Early arrival and setup time before the event starts.', 'logistics', 'fixed', null, 5000, true, true, 10),
  ('Teardown', 'Breakdown and load-out after the event ends.', 'logistics', 'fixed', null, 5000, true, true, 11),
  ('Travel', 'Mileage/travel charge beyond the package''s included travel radius.', 'logistics', 'per_unit', 'mile', 200, true, true, 12)
on conflict (name) do nothing;

-- Give every starter template a real "Core Performance" section with the
-- items every gig needs, so they're usable out of the box instead of
-- empty shells — admins add event-specific items (ceremony sound, etc.)
-- from the catalog picker on top of this.
do $$
declare
  tmpl record;
  new_section_id uuid;
begin
  for tmpl in select id from package_templates where is_starter = true loop
    if not exists (select 1 from package_sections where package_template_id = tmpl.id) then
      insert into package_sections (package_template_id, title, position)
      values (tmpl.id, 'Core Performance', 0)
      returning id into new_section_id;

      insert into package_line_items (section_id, catalog_item_id, included_quantity, selection_mode, position)
      select new_section_id, sci.id, 1, 'included', 0
      from service_catalog_items sci where sci.name = 'DJ Performance';

      insert into package_line_items (section_id, catalog_item_id, included_quantity, selection_mode, position)
      select new_section_id, sci.id, 1, 'optional', 1
      from service_catalog_items sci where sci.name = 'Setup';

      insert into package_line_items (section_id, catalog_item_id, included_quantity, selection_mode, position)
      select new_section_id, sci.id, 1, 'optional', 2
      from service_catalog_items sci where sci.name = 'Teardown';

      insert into package_line_items (section_id, catalog_item_id, included_quantity, min_quantity, max_quantity, selection_mode, position)
      select new_section_id, sci.id, 0, 0, 8, 'optional', 3
      from service_catalog_items sci where sci.name = 'Additional Performance Time';
    end if;
  end loop;
end $$;
