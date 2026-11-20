-- Payments recorded by hand (cash, check, Zelle, Venmo...) alongside the
-- Stripe ones. Additive only. A mistaken entry is voided, not deleted,
-- so the history stays intact; voided rows don't count toward the balance.

alter table payments add column if not exists method text check (method is null or method in ('card', 'cash', 'check', 'zelle', 'venmo', 'cash_app', 'paypal', 'bank_transfer', 'other'));
alter table payments add column if not exists reference text check (reference is null or char_length(reference) <= 120);
alter table payments add column if not exists note text check (note is null or char_length(note) <= 1000);
alter table payments add column if not exists recorded_by uuid references auth.users(id) on delete set null;
alter table payments add column if not exists voided_at timestamptz;
alter table payments add column if not exists voided_by uuid references auth.users(id) on delete set null;
alter table payments add column if not exists void_reason text check (void_reason is null or char_length(void_reason) <= 300);

-- Existing Stripe payments were paid by card.
update payments set method = 'card' where method is null and stripe_payment_intent_id is not null;
