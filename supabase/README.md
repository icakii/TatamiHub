# Supabase project setup

This folder holds the SQL and Edge Functions for the one shared Supabase
project used by both `TatamiHub` and `KimeClub`. Steps 1-5 need no tooling —
paste straight into the dashboard's SQL Editor. Step 6 (the Edge Function)
needs the Supabase CLI, since it deploys code rather than SQL.

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
4. `migrations/0004_drop_self_claim.sql` — removes the invite-code/email self-claim functions and column. There's no public self-registration.
5. `migrations/0005_guardian_info_and_lockdown.sql` — adds optional guardian/parent contact fields to `members`, and locks member writes down to platform admins only. Club staff can still read their own club's members (including guardian info); adding/editing members happens from TatamiHub, not the club site — a coach who wants a change calls/texts us.

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

## 6. Deploy the account-creation Edge Function

Students never self-register. A coach/owner creates each login from the
admin panel, which calls `functions/create-member-account`. That function
needs the `service_role` key to create another person's login, so it has to
run on Supabase's servers, not in the browser — deploying it needs the CLI:

```bash
npm install -g supabase
supabase login
supabase link --project-ref <your-project-ref>   # found in the dashboard URL
supabase functions deploy create-member-account
```

No manual secrets to set: Supabase automatically gives every Edge Function
`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` as
environment variables. The function itself checks the caller is an
owner/coach of the target club (via `is_club_staff()`) before creating
anything, so it's safe to leave publicly reachable.

## Re-running after schema changes

Every migration file uses `create table if not exists` / `create or replace function` / `drop policy if exists` so they're safe to re-run. `seed.sql` is also safe to re-run in full, top to bottom: rows with a fixed demo UUID use `on conflict (id) do nothing`, `club_billing`'s prices use an upsert (so pricing changes actually apply on re-run, without resetting `paid_until`), and the few tables with no fixed id (`payments`, `notifications`, `class_notices`, `member_notes`) delete their own demo rows right before re-inserting them.
