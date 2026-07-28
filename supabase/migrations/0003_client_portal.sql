-- Client Portal: lets a client who booked with Digital Crate DJs log in
-- and manage their own event (must_play/do_not_play/notes — fields that
-- already existed on `events` but were never exposed to anyone).
--
-- Mirrors djs.auth_user_id exactly: one nullable, unique FK to auth.users.
-- Linking happens server-side by matching the AUTHENTICATED session's
-- verified email against clients.email (never a user-submitted email) —
-- see /api/portal/link — so a client record can only be claimed by
-- someone who actually owns that inbox, the same trust boundary Supabase
-- Auth's own email verification already provides.

alter table clients add column if not exists auth_user_id uuid unique references auth.users(id) on delete set null;

create index if not exists idx_clients_auth_user on clients(auth_user_id) where auth_user_id is not null;
