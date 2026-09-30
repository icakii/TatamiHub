-- Proves the RLS policies in 0003_rls.sql actually hold, using the demo
-- data from supabase/seed.sql. Run migrations + seed first, then run this
-- whole file in one go (Supabase SQL Editor, or `psql -f`).
--
-- How it works: each block switches to the `authenticated` (or `anon`)
-- Postgres role and fakes a JWT via request.jwt.claims, the same way
-- PostgREST does it for a real logged-in request. Every check either prints
-- a PASS notice or raises an exception, so a clean run with no errors means
-- every policy behaved as expected.

-- ---------------------------------------------------------------------------
-- Kime student (student1) — can read their own stuff, nothing from club B
-- ---------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-4000-8000-000000000003')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from members where id = 'm1000000-0000-4000-8000-000000000003';
  if v_count <> 1 then raise exception 'FAIL: student1 should read own member row (got %)', v_count; end if;
  raise notice 'PASS: student1 reads own member row';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from members where club_id = 'c2000000-0000-4000-8000-000000000001';
  if v_count <> 0 then raise exception 'FAIL: student1 should not see club B members (got %)', v_count; end if;
  raise notice 'PASS: student1 cannot read club B members';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from payments;
  if v_count <> 1 then raise exception 'FAIL: student1 should see exactly their own payment (got %)', v_count; end if;
  raise notice 'PASS: student1 sees only their own payment';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from member_notes where member_id = 'm1000000-0000-4000-8000-000000000003';
  if v_count <> 0 then raise exception 'FAIL: student1 should not read coach notes about themselves (got %)', v_count; end if;
  raise notice 'PASS: student1 cannot read their own coach notes';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from notifications;
  if v_count <> 1 then raise exception 'FAIL: student1 should see exactly their own notification (got %)', v_count; end if;
  raise notice 'PASS: student1 sees only their own notification';
end $$;

-- ---------------------------------------------------------------------------
-- Club B student — cannot see anything from Kime
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'a2000000-0000-4000-8000-000000000001')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from members where club_id = 'c1000000-0000-4000-8000-000000000001';
  if v_count <> 0 then raise exception 'FAIL: club B student should not see Kime members (got %)', v_count; end if;
  raise notice 'PASS: club B student cannot read Kime members';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from payments;
  if v_count <> 1 then raise exception 'FAIL: club B student should see exactly their own payment (got %)', v_count; end if;
  raise notice 'PASS: club B student sees only their own payment';
end $$;

-- ---------------------------------------------------------------------------
-- Kime coach — sees every member/payment/note in their own club, nothing
-- from club B
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', json_build_object('sub', 'a1000000-0000-4000-8000-000000000002')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from members where club_id = 'c1000000-0000-4000-8000-000000000001';
  if v_count <> 12 then raise exception 'FAIL: coach should see all 12 Kime members (got %)', v_count; end if;
  raise notice 'PASS: coach reads all Kime members';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from members where club_id = 'c2000000-0000-4000-8000-000000000001';
  if v_count <> 0 then raise exception 'FAIL: coach should not see club B members (got %)', v_count; end if;
  raise notice 'PASS: coach cannot read club B members';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from member_notes where member_id = 'm1000000-0000-4000-8000-000000000003';
  if v_count <> 1 then raise exception 'FAIL: coach should read their own note (got %)', v_count; end if;
  raise notice 'PASS: coach reads the coach note';
end $$;

-- ---------------------------------------------------------------------------
-- Anonymous visitor — only public, live-club data
-- ---------------------------------------------------------------------------
set role anon;
select set_config('request.jwt.claims', '{}', false);

do $$
declare v_count int;
begin
  select count(*) into v_count from clubs where slug = 'kime';
  if v_count <> 1 then raise exception 'FAIL: anon should see the live Kime club (got %)', v_count; end if;
  raise notice 'PASS: anon reads the public Kime club row';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from club_billing;
  if v_count <> 0 then raise exception 'FAIL: anon should never see club_billing (got %)', v_count; end if;
  raise notice 'PASS: anon cannot read club_billing';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from members;
  if v_count <> 0 then raise exception 'FAIL: anon should not see any members (got %)', v_count; end if;
  raise notice 'PASS: anon cannot read members';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from belts where club_id = 'c1000000-0000-4000-8000-000000000001';
  if v_count <> 7 then raise exception 'FAIL: anon should see all 7 public belts (got %)', v_count; end if;
  raise notice 'PASS: anon reads the public belt ladder';
end $$;

reset role;
select set_config('request.jwt.claims', '{}', false);

-- ---------------------------------------------------------------------------
-- Platform admin — sees everything, including cross-club and billing
-- ---------------------------------------------------------------------------
insert into platform_admins (user_id) values ('a3000000-0000-4000-8000-000000000001')
on conflict (user_id) do nothing;

set role authenticated;
select set_config('request.jwt.claims', json_build_object('sub', 'a3000000-0000-4000-8000-000000000001')::text, false);

do $$
declare v_count int;
begin
  select count(*) into v_count from members;
  if v_count <> 13 then raise exception 'FAIL: platform admin should see all 13 members across both clubs (got %)', v_count; end if;
  raise notice 'PASS: platform admin reads members across every club';
end $$;

do $$
declare v_count int;
begin
  select count(*) into v_count from club_billing;
  if v_count <> 1 then raise exception 'FAIL: platform admin should read club_billing (got %)', v_count; end if;
  raise notice 'PASS: platform admin reads club_billing';
end $$;

reset role;
select set_config('request.jwt.claims', '{}', false);
delete from platform_admins where user_id = 'a3000000-0000-4000-8000-000000000001';

do $$ begin raise notice 'ALL RLS CHECKS PASSED'; end $$;
