-- Additive "pipeline_stage" for the client-facing sales funnel (Inquiry,
-- Follow-up, Meeting, Proposal Sent, Proposal Signed, Retainer Paid,
-- Planning, Live, Completed, Declined, Archived) — modeled on HoneyBook's
-- pipeline view. This is deliberately a SEPARATE field from `status`.
-- `status` (inquiry/pending_confirmation/confirmed/live/ended/declined)
-- keeps driving DJ confirm/decline, Calendar, Finance, and Reports exactly
-- as before — none of that logic changes. pipeline_stage is a purely
-- additive, informational layer so admins and DJs can see where a project
-- sits in the sales/planning funnel without touching what already works.
alter table events add column if not exists pipeline_stage text default 'Inquiry';

update events set pipeline_stage = case
  when status = 'inquiry' then 'Inquiry'
  when status = 'pending_confirmation' then 'Follow-up'
  when status = 'confirmed' then 'Planning'
  when status = 'live' then 'Live'
  when status = 'ended' then 'Completed'
  when status = 'declined' then 'Declined'
  else 'Inquiry'
end
where pipeline_stage is null;
