-- events.event_type is free text with three uncoordinated writers (this
-- app's own dropdown, the Scheduler's hardcoded "consultation", and an
-- external WordPress form posting into /api/inquiries with no
-- validation) — so the same real category shows up as "Wedding",
-- "wedding", or any WordPress-side spelling. event_category is the
-- derived, canonical value (see src/lib/event-category.ts) every
-- comparison in the app should use going forward instead of the raw
-- text; event_type itself is untouched and keeps its display text.
alter table events add column if not exists event_category text;

-- One-time backfill mirroring deriveEventCategory()'s exact-match table,
-- for the values actually seen in production at the time of this
-- migration (verified via direct query, not assumed):
--   null -> null (a real "not specified" state, not "other")
--   'Other' -> 'other'
--   'Club / Bar Night' -> 'bar_nightclub'
--   'Wedding' / 'wedding' -> 'wedding'
update events set event_category = case
  when event_type is null then null
  when lower(event_type) = 'wedding' then 'wedding'
  when lower(event_type) = 'school dance' then 'school_dance'
  when lower(event_type) = 'club / bar night' then 'bar_nightclub'
  when lower(event_type) = 'corporate event' then 'corporate'
  when lower(event_type) = 'holiday party' then 'holiday'
  when lower(event_type) = 'birthday / private party' then 'private_party'
  when lower(event_type) = 'consultation' then 'consultation'
  when lower(event_type) = 'other' then 'other'
  -- fallback fuzzy match, mirroring the FUZZY_PATTERNS in event-category.ts,
  -- for any value outside the exact set above (e.g. WordPress free text)
  when event_type ilike '%wedding%' then 'wedding'
  when event_type ilike '%school%' or event_type ilike '%prom%' or event_type ilike '%homecoming%' then 'school_dance'
  when event_type ilike '%bar%' or event_type ilike '%nightclub%' or event_type ilike '%club%' then 'bar_nightclub'
  when event_type ilike '%corporate%' or event_type ilike '%company%' or event_type ilike '%office%' then 'corporate'
  when event_type ilike '%holiday%' then 'holiday'
  when event_type ilike '%private%' or event_type ilike '%birthday%' or event_type ilike '%anniversary%' or event_type ilike '%graduation%' or event_type ilike '%festival%' then 'private_party'
  when event_type ilike '%consult%' then 'consultation'
  else 'other'
end
where event_category is null;
