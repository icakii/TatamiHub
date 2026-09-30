# Supabase project setup

This folder holds the SQL for the one shared Supabase project used by both
`TatamiHub` and `KimeClub`. There's no Supabase CLI dependency required —
everything below can be pasted straight into the dashboard's SQL Editor.

## 1. Create the project

1. Go to [supabase.com](https://supabase.com) and sign in (or create a free account).
2. **New project** -> pick your organization -> name it (e.g. `tatami`) -> set a database password (save it somewhere, you'll want it later for direct Postgres access) -> pick a region close to Bulgaria (e.g. Frankfurt) -> **Create new project**. Free tier, no card required.
3. Once it's done provisioning, go to **Project Settings -> API**. You need two values from that page for both repos' `.env`:
   - **Project URL** -> `VITE_SUPABASE_URL`
   - **anon public** key (under Project API keys) -> `VITE_SUPABASE_ANON_KEY`

Never copy the `service_role` key into either app's `.env` — that key bypasses RLS entirely and must only ever live in an Edge Function secret.

## 2. Run the migrations

Open **SQL Editor** in the dashboard, and run these files in this exact order (paste contents, click Run):

1. `migrations/0001_schema.sql` — all tables
2. `migrations/0002_functions.sql` — `is_platform_admin()`, `member_role()`, `is_club_staff()`
3. `migrations/0003_rls.sql` — enables RLS and creates every policy
4. `migrations/0004_drop_self_claim.sql` — removes the invite-code/email self-claim functions and column. There's no public self-registration: a coach/owner creates each student's login directly (planned as an Edge Function using the service-role key, since creating another person's auth account needs elevated privileges no browser client should ever hold).

## 3. Load the demo data (optional but recommended)

Run `seed.sql`. It creates:

- Kime Karate Club (`localhost` domain, 7 belts, 3 classes, one schedule-change notice)
- 12 fictional members with a mix of belts, statuses and payment states
- A second, minimal "RLS Test Club B" used only by the test script below to prove cross-club isolation

Everything in it is fictional and marked as such in the file.

## 4. Prove the RLS policies actually work

Run `tests/rls_test.sql` after the migrations and seed. It impersonates a Kime student, a Club B student, the Kime coach, an anonymous visitor, and a platform admin (by faking the JWT `sub` claim the same way PostgREST does), and asserts each one can only see what they should. A clean run ends with `ALL RLS CHECKS PASSED`; any violation raises an exception naming exactly which check failed.

## 5. Make yourself a platform admin

Sign up through the TatamiHub app once it's deployed, then find your user id under **Authentication -> Users** in the dashboard and run:

```sql
insert into platform_admins (user_id) values ('YOUR-AUTH-USER-UUID');
```

## Re-running after schema changes

Every migration file uses `create table if not exists` / `create or replace function` / `drop policy if exists` so they're safe to re-run. `seed.sql` uses `on conflict (id) do nothing` for its fixed demo UUIDs, so re-running it won't duplicate rows.
