-- Phase 1 of the CRM restructure (see audit artifact from 2026-08-13).
--
-- `events.status` (inquiry/pending_confirmation/confirmed/live/ended/declined)
-- already drives DJ confirm/decline, Calendar, and Finance — it stays as-is,
-- nothing reads it differently after this migration.
--
-- `events.pipeline_stage` (added 0009) was meant to be an independent sales
-- funnel, but in production it's drifted out of sync with `status` (every
-- live event is stuck at pipeline_stage='Inquiry' regardless of status) —
-- that's the "Confirmed + Inquiry" conflict from the audit. Rather than try
-- to reconcile two already-drifted free-text fields, this adds a third,
-- narrower field — `event_status` — with exactly the 4 values the audit
-- recommended (tentative/confirmed/cancelled/completed), derived once from
-- the authoritative `status` column (not pipeline_stage, since status is
-- what Calendar/Finance/DJ actions actually operate on). Going forward,
-- application code sets event_status alongside status so the two can't
-- drift apart the way status/pipeline_stage did.
--
-- Lead fields (lead_source, estimated_value, next_follow_up_at) are added
-- directly to `events` rather than a separate `leads` table — per the
-- audit's decision, a "lead" here is just an event at its earliest
-- lifecycle stage (status='inquiry'), and creating a second table for it
-- would reintroduce exactly the duplicate-record problem this whole
-- restructure exists to remove.

alter table events add column if not exists event_status text;

update events set event_status = case
  when status in ('inquiry', 'pending_confirmation') then 'tentative'
  when status in ('confirmed', 'live') then 'confirmed'
  when status = 'ended' then 'completed'
  when status = 'declined' then 'cancelled'
  else 'tentative'
end
where event_status is null;

alter table events alter column event_status set default 'tentative';
alter table events alter column event_status set not null;

alter table events add constraint events_event_status_check
  check (event_status in ('tentative', 'confirmed', 'cancelled', 'completed'));

alter table events add column if not exists lead_source text;
alter table events add column if not exists estimated_value numeric(10, 2);
alter table events add column if not exists next_follow_up_at timestamptz;

create index if not exists idx_events_event_status on events(event_status);
create index if not exists idx_events_next_follow_up on events(next_follow_up_at) where next_follow_up_at is not null;
