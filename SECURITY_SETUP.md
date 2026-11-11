# Inquiry, booking and portal security: setup

This is the setup for the `security-hardening` branch: what to configure and in what order. Nothing here contains real secrets. Generate your own values and keep them only in Vercel and WordPress settings.

> **Important:** the public inquiry and consultation forms refuse submissions until Turnstile is configured. This is on purpose: an unconfigured check never counts as passed. Set up Turnstile (step 2) before deploying this branch, or the website forms will stop taking requests.

## 1. Database migrations (Supabase → SQL editor, in order)

1. **Before deploying the code:** `supabase/migrations/0045_inquiry_security.sql`
   - Creates the new tables:
     - `inquiry_submissions`
     - `consultation_holds`
     - `security_rate_limits`
     - `security_blocks`
     - `security_events`
     - `security_used_tokens`
     - `processed_webhook_events`
   - Creates the database functions: rate limiting, holds, guarded confirm, maintenance.
   - Copies staff roles from `user_metadata.role` into `app_metadata.role` (one time). The new code reads roles **only** from `app_metadata`, which users can't edit.
   - Additive only: existing `events`, `clients`, payments and contracts are untouched.
2. **After the new code is live and you've checked a contract/file download works:** `supabase/migrations/0046_private_event_files_bucket.sql`
   - Makes the `event-files` storage bucket private.
   - From then on, files are only reachable through `/api/files/...`. That route checks the person may see the file, then hands out a 2-minute signed link.
   - Old public URLs stop working, which is the point.

Check the role copy after 0045:

```sql
select email, raw_app_meta_data->>'role' as role from auth.users where raw_app_meta_data ? 'role' order by 2;
```

Set or change a staff role later only from SQL or the Supabase dashboard:

```sql
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"role":"owner"}' where email = 'you@example.com';
```

## 2. Environment variables (Vercel → Project → Settings → Environment Variables)

| Variable | Required | What it does |
|---|---|---|
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | **Yes** | Cloudflare Turnstile site key (public). |
| `TURNSTILE_SECRET_KEY` | **Yes** | Turnstile secret key (server only). |
| `TURNSTILE_ALLOWED_HOSTNAMES` | No | Comma list. Default: `cratesdjs.com,www.cratesdjs.com,requests.digitalcratedjs.com`. |
| `SECURITY_HASH_SECRET` | **Yes** | 32+ random characters. Keys the hashes of IPs and emails used for rate limits and blocks. Generate with `openssl rand -hex 32`. |
| `CRON_SECRET` | **Yes** | 16+ characters. Vercel Cron sends it automatically. Without it, all cron routes now refuse requests. |
| `NEXT_PUBLIC_APP_URL` | **Yes** | `https://www.cratesdjs.com`. Used for confirmation links and the CSRF origin check. |
| `RESEND_API_KEY`, `SYSTEM_EMAIL_FROM` | **Yes** | Already used for system email. Confirmation emails go out through these. |
| `TRUSTED_PROXY` | **Yes** | `vercel` on Vercel (or `cloudflare` if Cloudflare proxies the site). Decides which header holds the real visitor IP. |
| `INQUIRY_PARTNER_SECRET` | For WordPress | 32+ random characters. Must match `DC_CRM_PARTNER_KEY` in WordPress (step 5). |
| `ADMIN_MFA_REQUIRED` | Recommended | `true` makes two-factor mandatory for every staff account. Until then it's enforced only for staff who have set it up. |
| `BOOKING_REQUIRE_SIGNED_CONTRACT` | Optional | `true`: a booking can't be confirmed until its contract is signed. |
| `BOOKING_REQUIRE_DEPOSIT` | Optional | `true`: a booking can't be confirmed until Stripe reports a deposit. |
| `INQUIRY_VERIFICATION_TTL_HOURS` | Optional | Default `24`. |
| `CSRF_ALLOWED_ORIGINS` | Optional | Extra origins allowed to POST to the API (comma list). |
| `RL_*` | Optional | Rate limits, defaults in `src/lib/security/rate-limit.ts`. `RL_INQUIRY_PER_IP=5` per `RL_INQUIRY_WINDOW_SECONDS=900`; `RL_VERIFY_EMAIL_PER_EMAIL=3` per hour; `RL_VERIFY_EMAIL_PER_IP=10` per hour. |
| `STRIPE_WEBHOOK_SECRET` | Already set? | Now **required**: without it the webhook refuses every event. |

## 3. Cloudflare Turnstile

1. Cloudflare dashboard → Turnstile → Add widget.
2. Hostnames: `cratesdjs.com`, `www.cratesdjs.com`, `requests.digitalcratedjs.com`.
3. Mode: **Managed**.
4. Copy the site key and secret key into the two variables above.
5. (Recommended) Supabase → Authentication → Attack Protection → enable CAPTCHA → Turnstile, using the same secret. The login, sign-up and password-reset pages already send the token.

## 4. Supabase Auth

- **Two-factor:** Authentication → Multi-Factor → enable TOTP.
  - Each owner/admin then opens **Admin → Inquiry Security → Two-factor** and adds an authenticator, plus a backup device.
  - Lockout recovery: Supabase dashboard → Authentication → Users → user → remove the MFA factor.
- **Email:** keep "Confirm email" on. The portal now links a client to their bookings only after they've confirmed their email.

## 5. WordPress (digitalcratedjs.com)

The theme's booking forms post to the CRM server-to-server.

1. Add this line to `wp-config.php`, above "That's all, stop editing", using the same value as `INQUIRY_PARTNER_SECRET`:

   ```php
   define('DC_CRM_PARTNER_KEY', 'paste-the-same-32+-character-value');
   ```

   The theme then sends it with the visitor's IP, and the CRM skips Turnstile for these requests only.
2. Without it, the CRM refuses WordPress submissions, and the theme falls back to its old email-only path. Nothing is lost, but those requests don't reach the CRM.
3. The past-date block on the WordPress forms is in the theme and works on its own, with or without this key.

## 6. Resend

The sending domain in `SYSTEM_EMAIL_FROM` must be verified in Resend (SPF/DKIM), or confirmation emails land in spam.

## Deploy order

1. Apply migration 0045.
2. Set the env vars (Turnstile, hash secret, cron secret, proxy, partner secret).
3. Deploy the branch.
4. Add `DC_CRM_PARTNER_KEY` to WordPress.
5. Test on the live site:
   - one inquiry from the website and one from WordPress: you should see "check your email", the link should confirm, and the lead should appear in Lead Capture;
   - a contract download from the portal;
   - an admin approve on the Inquiry Security page.
6. Apply migration 0046.
7. Turn on `ADMIN_MFA_REQUIRED=true` once every owner/admin has two-factor set up.

## What's protected, and what stays off until configured

| Protection | Active when |
|---|---|
| Past-date block, server validation, honeypot, duplicates, spam scoring, email verification, admin review, ownership checks, private headers, safe redirects, CSRF origin check, webhook idempotency | As soon as the code and migration 0045 are deployed |
| Turnstile on inquiry and consultation forms | Turnstile keys set (forms refuse submissions until then) |
| Turnstile on login, sign-up and password reset | Supabase CAPTCHA enabled |
| Keyed hashing of IPs and emails | `SECURITY_HASH_SECRET` set (otherwise plain SHA-256; the dashboard shows a warning) |
| Two-factor for all staff | `ADMIN_MFA_REQUIRED=true` (otherwise only for staff who enrolled) |
| Contract or deposit required to confirm | The two `BOOKING_REQUIRE_*` flags |
| Private project files | Migration 0046 applied |
| WordPress → CRM hand-off | `INQUIRY_PARTNER_SECRET` and `DC_CRM_PARTNER_KEY` set to the same value |
