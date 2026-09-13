-- Real e-signature via SignWell, replacing the typed-name-only flow.
-- signed_at/signed_by_name/signed_ip/signed_user_agent stay (harmless,
-- just unused when esign_document_id is set) — no data loss for any
-- contract already signed the old way.
alter table contracts add column if not exists esign_document_id text;
alter table contracts add column if not exists esign_status text;
