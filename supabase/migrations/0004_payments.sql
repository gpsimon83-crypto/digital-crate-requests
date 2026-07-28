-- Payment Processing (Roadmap Phase 2, Module 8) — deposit/balance
-- collection against an event's quoted_amount/deposit_amount/
-- final_amount (added in 0002_crm_foundation.sql).
--
-- Deliberately just one `payments` table, not the full
-- invoices/invoice_line_items/payments split the Tech Spec describes —
-- this business doesn't itemize line items, `events` already carries the
-- amount fields, and a single-tenant shop with no line-item billing gets
-- nothing from that extra structure. `payments` is the ledger of actual
-- money received; "amount owed" is computed as
-- quoted/final_amount - sum(succeeded payments), not stored redundantly.
--
-- Reuses the exact PaymentIntent + webhook pattern already used for tips
-- and song-request boosts (see /api/tips/create-intent and
-- /api/stripe/webhook) — a payments row is only ever written by the
-- webhook on payment_intent.succeeded, never by the client-facing route
-- that creates the intent, so money is never recorded that didn't
-- actually land.

create table if not exists payments (
  id uuid primary key default uuid_generate_v4(),
  event_id uuid not null references events(id) on delete cascade,
  kind text not null, -- deposit, balance, other
  amount_cents integer not null,
  status text not null default 'pending', -- pending, succeeded, failed
  stripe_payment_intent_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  constraint positive_amount check (amount_cents > 0)
);

create index if not exists idx_payments_event on payments(event_id);
create index if not exists idx_payments_status on payments(event_id, status);

alter table payments enable row level security;
